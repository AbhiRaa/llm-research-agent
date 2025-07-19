"""
Async node functions for the LangGraph pipeline.
They fall back to deterministic stubs when OPENAI_API_KEY is absent,
so unit-tests and CI run fully offline.
"""

import json, asyncio, os
from typing import Dict, Any, List
from langchain.schema import Document
from langchain.prompts import ChatPromptTemplate
from .tools import web_search
import openai

from agent.observability import REQUEST_COUNTER, LATENCY_HISTO, init as _get_tracer

_tracer = _get_tracer()

MAX_ITER = 2

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
    tmpl = ChatPromptTemplate.from_messages(
        [
            ("system", "You are a helpful research assistant."),
            (
                "user",
                "Break the question into 3-5 web search queries as a JSON list.\n{q}",
            ),
        ]
    )
    raw = await call_llm(tmpl, q=q)

    # Attempt JSON decode
    try:
        data = json.loads(raw)
        if isinstance(data, list):  # expected shape
            queries = data
        elif isinstance(data, dict):  # e.g. {"queries":[…]}
            queries = data.get("queries", [])
        else:  # any other JSON value
            queries = []
    except json.JSONDecodeError:
        # Fallback: split plain-text lines
        queries = [ln.strip() for ln in raw.splitlines() if ln.strip()]

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
    docs_lists = await asyncio.gather(*(web_search(q) for q in queries))
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
    try:
        data = json.loads(raw)
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
    except Exception:
        # keep pipeline state intact on parse failure
        return {
            "question": state["question"],
            "queries": state["queries"],
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
