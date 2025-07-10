"""
Node functions for the LangGraph pipeline.
Each node takes `state` (dict) and returns partial updates.
"""
import json, asyncio
from typing import Dict, Any, List
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document
from .tools import web_search

llm = ChatOpenAI(temperature=0)


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
    raw = await llm.apredict(tmpl.format(q=q))
    try:
        queries = json.loads(raw)
    except Exception:
        queries = [line.strip() for line in raw.splitlines() if line.strip()]
    return {"queries": queries[:5]}


# ------------------------------------------------------------------ Search
async def search_node(state: Dict[str, Any]) -> Dict[str, Any]:
    queries: List[str] = state["queries"]
    docs_lists = await asyncio.gather(*(web_search(q) for q in queries))
    merged: Dict[str, Document] = {}
    for lst in docs_lists:
        for d in lst:
            merged[d.metadata["url"]] = d
    return {"docs": list(merged.values())[:5]}


# ------------------------------------------------------------------ Reflect
async def reflect_node(state: Dict[str, Any]) -> Dict[str, Any]:
    docs: List[Document] = state["docs"]
    ctx = "\n".join(d.page_content for d in docs)
    tmpl = ChatPromptTemplate.from_messages(
        [
            ("system", "Decide if the docs fully answer the question."),
            (
                "user",
                'Reply with JSON {"need_more":bool,"new_queries":list}.\nQuestion:{q}\nDocs:\n{ctx}',
            ),
        ]
    )
    raw = await llm.apredict(tmpl.format(q=state["question"], ctx=ctx[:4000]))
    try:
        data = json.loads(raw)
        return {
            "need_more": bool(data.get("need_more")),
            "queries": data.get("new_queries") or state["queries"],
        }
    except Exception:
        return {"need_more": False}


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
    answer = await llm.apredict(tmpl.format(q=state["question"], e=evidence))
    citations = [
        {"id": i + 1, "title": d.metadata.get("title"), "url": d.metadata["url"]}
        for i, d in enumerate(docs[:3])
    ]
    return {"answer": answer.strip(), "citations": citations}
