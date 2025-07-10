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
async def generate_node(state: Dict[str, Any]) -> Dict[str, Any]:
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
    try:
        queries = json.loads(raw)
        if isinstance(queries, dict):  # unwrap {"queries": [...]}
            queries = queries.get("queries", [])
    except Exception:
        queries = [line.strip() for line in raw.splitlines() if line.strip()]
    return {"question": q, "queries": queries[:5]}  # keep question


# ------------------------------------------------------------------ Search
async def search_node(state: Dict[str, Any]) -> Dict[str, Any]:
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
    }


# ------------------------------------------------------------------ Reflect
async def reflect_node(state: Dict[str, Any]) -> Dict[str, Any]:
    docs: List[Document] = state["docs"]
    ctx = "\n".join(d.page_content for d in docs)

    tmpl = ChatPromptTemplate.from_messages(
        [
            ("system", "Decide if the docs fully answer the question."),
            (
                "user",
                (
                    "Reply with JSON {{"
                    '"need_more":bool,'
                    '"new_queries":list'
                    "}}.\nQuestion:{q}\nDocs:\n{ctx}"
                ),
            ),
        ]
    )
    raw = await call_llm(tmpl, q=state["question"], ctx=ctx[:4000])
    try:
        data = json.loads(raw)
        return {
            "question": state["question"],
            "queries": data.get("new_queries") or state["queries"],
            "need_more": bool(data.get("need_more")),
            "docs": state["docs"],
        }
    except Exception:
        # keep pipeline state intact on parse failure
        return {
            "question": state["question"],
            "queries": state["queries"],
            "need_more": False,
            "docs": docs,
        }


# ------------------------------------------------------------------ Synthesize
async def synthesize_node(state: Dict[str, Any]) -> Dict[str, Any]:
    docs: List[Document] = state["docs"]
    evidence = "\n".join(f"[{i+1}] {d.page_content}" for i, d in enumerate(docs[:3]))
    tmpl = ChatPromptTemplate.from_messages(
        [
            ("system", "Answer in ≤80 English words and end with numeric citations."),
            ("user", "Question:{q}\nEvidence:\n{e}"),
        ]
    )
    answer = await call_llm(tmpl, q=state["question"], e=evidence)
    citations = [
        {"id": i + 1, "title": d.metadata.get("title"), "url": d.metadata["url"]}
        for i, d in enumerate(docs[:3])
    ]
    return {"answer": answer.strip(), "citations": citations}
