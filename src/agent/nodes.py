"""
Async node functions for the LangGraph pipeline.
They fall back to deterministic stubs when OPENAI_API_KEY is absent,
so unit-tests and CI run fully offline.
"""

import json, asyncio, os, re
from typing import Dict, Any, List, AsyncIterator
from langchain.schema import Document
from langchain.prompts import ChatPromptTemplate
from .tools import web_search
import openai

from agent.observability import REQUEST_COUNTER, LATENCY_HISTO, init as _get_tracer

_tracer = _get_tracer()

MAX_ITER = 2


def _extract_json(raw: str):
    """Best-effort JSON parse: strips ```fences and digs out the first
    {...}/[...] block, since gpt-3.5 often wraps JSON in prose."""
    if not raw:
        return None
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"(\{.*\}|\[.*\])", raw, re.S)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                return None
    return None

# ------------------------------------------------------------------ LLM setup
USE_LLM = bool(os.getenv("OPENAI_API_KEY"))


# Offline-stub helper reused in both modes
async def _offline_stub(prompt: ChatPromptTemplate, **kwargs) -> str:
    """Generate deterministic JSON/text for unit tests & fallback."""
    if "ctx" in kwargs:  # Reflect node
        return json.dumps({"need_more": False, "new_queries": []})
    if "e" in kwargs:  # Synthesize node
        return f"Stub answer for: {kwargs['q']} [1]"
    return json.dumps([kwargs["q"]])  # GenerateQueries node


if USE_LLM:
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

    async def call_llm(prompt: ChatPromptTemplate, **kwargs) -> str:
        try:
            # new, non-deprecated async invoke
            msg = await llm.ainvoke(prompt.format(**kwargs))
            return msg.content  # ← extract text

        # graceful fallback on quota/auth/rate-limit issues
        except (
            openai.RateLimitError,
            openai.AuthenticationError,
            openai.APIError,
        ):
            return await _offline_stub(prompt, **kwargs)

else:
    # No API key – always use stub
    async def call_llm(prompt: ChatPromptTemplate, **kwargs) -> str:  # type: ignore
        return await _offline_stub(prompt, **kwargs)


# ------------------------------------------------------------------ Generate
@_tracer.start_as_current_span("generate")
async def generate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    with LATENCY_HISTO.labels("generate").time():
        REQUEST_COUNTER.labels("generate").inc()

    q = state["question"]
    history = state.get("history") or ""
    hist_block = f"Conversation so far:\n{history}\n\n" if history else ""
    tmpl = ChatPromptTemplate.from_messages(
        [
            ("system", "You are a helpful research assistant."),
            (
                "user",
                "Using the prior conversation (if any) to resolve references like "
                "'it', 'that' or 'there', rewrite the user's question into 3-5 "
                "standalone web search queries as a JSON list.\n{hist}{q}",
            ),
        ]
    )
    raw = (await call_llm(tmpl, q=q, hist=hist_block)).strip()

    # strip ```json fences the model sometimes wraps around the list
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", raw).strip()

    try:
        data = json.loads(raw)
        if isinstance(data, list):  # expected shape
            queries = data
        elif isinstance(data, dict):  # {"queries":[…]} or any list-valued key
            queries = next((v for v in data.values() if isinstance(v, list)), [])
        else:
            queries = []
    except json.JSONDecodeError:
        # plain-text lines, stripped of bullets/numbering
        queries = [re.sub(r"^[\s\-•\d.\)]+", "", ln).strip() for ln in raw.splitlines()]

    # always keep at least the original question so search never runs empty
    queries = [s for s in queries if isinstance(s, str) and s.strip()] or [q]

    return {
        "question": q,
        "queries": queries[:5],
        "iter": state.get("iter", 0),
    }  # carry forward


# ------------------------------------------------------------------ Search
@_tracer.start_as_current_span("search")
async def search_node(state: Dict[str, Any]) -> Dict[str, Any]:
    with LATENCY_HISTO.labels("search").time():
        REQUEST_COUNTER.labels("search").inc()

    queries: List[str] = state["queries"]
    recency = state.get("recency")
    docs_lists = await asyncio.gather(
        *(web_search(q, recency=recency) for q in queries)
    )
    merged: Dict[str, Document] = {}
    for lst in docs_lists:
        for d in lst:
            merged[d.metadata["url"]] = d
    return {
        "question": state["question"],
        "queries": state["queries"],
        "docs": list(merged.values())[:5],
        "iter": state.get("iter", 0),
    }


# ------------------------------------------------------------------ Reflect
@_tracer.start_as_current_span("reflect")
async def reflect_node(state: Dict[str, Any]) -> Dict[str, Any]:
    with LATENCY_HISTO.labels("reflect").time():
        REQUEST_COUNTER.labels("reflect").inc()

    docs: List[Document] = state["docs"]
    ctx = "\n".join(d.page_content for d in docs)

    tmpl = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are an evidence checker.\n"
                "Step 1 – list the REQUIRED slots (facts) the answer must contain.\n"
                "Step 2 – read the docs and list which slots are already filled.\n"
                "Step 3 – output STRICT JSON exactly like:\n"
                '{{"slots": <list>, "filled": <list>, '
                '"need_more": <bool>, "new_queries": <list>}}\n'
                "Rules: need_more is true iff some slot missing OR conflicting docs. "
                "Return at most 3 new_queries.",
            ),
            ("user", "Question: {q}\nDocs:\n{ctx}"),
        ]
    )
    raw = await call_llm(tmpl, q=state["question"], ctx=ctx[:4000])
    data = _extract_json(raw)
    if isinstance(data, dict):
        need_more = bool(data.get("need_more"))
        if state["iter"] >= MAX_ITER - 1:
            need_more = False
        return {
            **state,
            "slots": data.get("slots", []),
            "filled": data.get("filled", []),
            "need_more": need_more,
            "queries": data.get("new_queries") or state["queries"],
            "iter": state["iter"] + 1,
        }
    # keep pipeline state intact on parse failure
    return {
        **state,
        "slots": [],
        "filled": [],
        "need_more": False,
        "docs": docs,
        "iter": state.get("iter", 0) + 1,  # still advance
    }


# ------------------------------------------------------------------ Synthesize
@_tracer.start_as_current_span("synthesize")
async def synthesize_node(state: Dict[str, Any]) -> Dict[str, Any]:
    with LATENCY_HISTO.labels("synthesize").time():
        REQUEST_COUNTER.labels("synthesize").inc()

    docs: List[Document] = state.get("docs", [])

    # Guarantee at least one citation so CLI & tests never break
    if not docs:
        docs = [
            Document(
                page_content="No external documents fetched; answering from prior knowledge.",
                metadata={"title": "Stub source", "url": "local"},
            )
        ]
    evidence = "\n".join(f"[{i+1}] {d.page_content}" for i, d in enumerate(docs[:3]))
    tmpl = ChatPromptTemplate.from_messages(
        [
            ("system", "Answer in ≤80 English words and end with numeric citations."),
            ("user", "Question:{q}\nEvidence:\n{e}"),
        ]
    )
    answer_raw = await call_llm(tmpl, q=state["question"], e=evidence)
    # remove any role prefixes the model may add
    answer = answer_raw.lstrip().removeprefix("Human:").removeprefix("Assistant:")

    citations = [
        {"id": i + 1, "title": d.metadata.get("title"), "url": d.metadata["url"]}
        for i, d in enumerate(docs[:3])
    ]
    return {"answer": answer.strip(), "citations": citations}


# ------------------------------------------------------------------ Streaming
async def call_llm_stream(
    prompt: ChatPromptTemplate, **kwargs
) -> AsyncIterator[str]:
    """Yield answer text incrementally.

    With a real key we stream tokens from the model; offline (or on
    quota/auth errors) we stream the deterministic stub word-by-word so the
    UI behaves identically with or without credentials.
    """
    if USE_LLM:
        try:
            async for chunk in llm.astream(prompt.format(**kwargs)):
                if chunk.content:
                    yield chunk.content
            return
        except (
            openai.RateLimitError,
            openai.AuthenticationError,
            openai.APIError,
        ):
            pass  # fall through to stub stream

    text = await _offline_stub(prompt, **kwargs)
    for token in re.findall(r"\S+\s*", text):
        yield token
        await asyncio.sleep(0.015)


_FORMAT_HINTS = {
    "bullets": "Format the answer as 2-4 short bullet points (use '- ' prefixes).",
    "tldr": "Begin with a one-line **TL;DR:** then add 2-3 sentences of detail.",
    "prose": "Write in clear, well-structured prose.",
}


async def synthesize_stream(state: Dict[str, Any]) -> AsyncIterator[Dict[str, Any]]:
    """Stream the answer with user-controlled length / sources / format.

    Yields {'type': 'token'|'citations', ...}. Reads max_words, max_sources and
    fmt from state (set by the streaming entrypoint).
    """
    docs: List[Document] = state.get("docs", [])
    if not docs:
        docs = [
            Document(
                page_content="No external documents fetched; answering from prior knowledge.",
                metadata={"title": "Stub source", "url": "local"},
            )
        ]
    max_words = int(state.get("max_words", 80))
    max_sources = max(1, min(int(state.get("max_sources", 3)), 5))
    fmt = state.get("fmt", "prose")
    use_docs = docs[:max_sources]

    evidence = "\n".join(
        f"[{i+1}] {d.page_content}" for i, d in enumerate(use_docs)
    )
    history = state.get("history") or ""
    sys = (
        f"Answer in at most {max_words} English words. "
        f"{_FORMAT_HINTS.get(fmt, _FORMAT_HINTS['prose'])} "
        "Ground every claim in the provided sources and cite them inline with "
        "numeric markers like [1]."
    )
    if history:
        sys += " Use the prior conversation for context but answer the latest question."
    tmpl = ChatPromptTemplate.from_messages(
        [("system", sys), ("user", "Question:{q}\nEvidence:\n{e}")]
    )

    first = True
    async for token in call_llm_stream(tmpl, q=state["question"], e=evidence):
        if first:  # trim leading role prefixes/whitespace the model may emit
            token = token.lstrip().removeprefix("Human:").removeprefix("Assistant:")
            first = False
        yield {"type": "token", "value": token}

    citations = [
        {
            "id": i + 1,
            "title": d.metadata.get("title"),
            "url": d.metadata.get("url", "local"),
            "snippet": (d.page_content or "")[:240],
        }
        for i, d in enumerate(use_docs)
    ]
    yield {"type": "citations", "value": citations}


def trim_words(text: str, max_words: int) -> str:
    """Safety net: hard-cap the answer length, preserving trailing [n] markers."""
    words = text.split()
    if len(words) <= max_words:
        return text
    kept = words[:max_words]
    # re-attach any citation markers that fell off the end so nothing is orphaned
    tail = [w for w in words[max_words:] if re.fullmatch(r"\[\d+\][.,]?", w)]
    return " ".join(kept + tail).rstrip() + " …"


async def generate_followups(question: str, answer: str) -> List[str]:
    """Suggest 2 natural follow-up questions (real LLM only; offline → none)."""
    if not USE_LLM:
        return []
    try:
        tmpl = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Suggest exactly 2 short, natural follow-up questions a curious "
                    "reader might ask next. Return ONLY a JSON list of strings.",
                ),
                ("user", "Question: {q}\nAnswer: {a}"),
            ]
        )
        raw = await call_llm(tmpl, q=question, a=answer)
        data = _extract_json(raw)
        if isinstance(data, dict):  # model sometimes wraps the list in an object
            data = next((v for v in data.values() if isinstance(v, list)), [])
        if isinstance(data, list):
            return [s for s in data if isinstance(s, str) and s.strip()][:3]
    except Exception:
        pass
    return []
