"""
LangGraph 0.5-compatible pipeline builder.
Implements: Generate ➜ Search ➜ Reflect (loop ≤2) ➜ Synthesize
"""

from typing import Dict, Any, AsyncIterator, Optional
from langgraph.graph import StateGraph

from .nodes import (
    generate_node,
    search_node,
    reflect_node,
    synthesize_node,
    synthesize_stream,
    trim_words,
    generate_followups,
)
from .cache import answer_cache_get, answer_cache_set

MAX_ITER = 2


def _build_graph():
    # ➊ Create the builder, telling LangGraph our state is a simple dict
    builder = StateGraph(Dict[str, Any])

    # ➋ Register the four async nodes
    builder.add_node("generate", generate_node)
    builder.add_node("search", search_node)
    builder.add_node("reflect", reflect_node)
    builder.add_node("synthesize", synthesize_node)

    # ➌ Define entry point and static edges
    builder.set_entry_point("generate")
    builder.add_edge("generate", "search")
    builder.add_edge("search", "reflect")

    # ➍ Conditional routing after Reflect
    def route_after_reflect(state: Dict[str, Any]) -> str:
        """Return next-node name based on reflect output."""
        state["iter"] = state.get("iter", 0) + 1
        if state["iter"] < MAX_ITER and state.get("need_more", False):
            # Loop back for a second search
            return "search"
        return "synthesize"

    builder.add_conditional_edges("reflect", route_after_reflect)

    # ➎ Compile the graph object
    return builder.compile()


# Keep a singleton compiled graph in memory
_GRAPH = _build_graph()


# ----------- Public helpers -------------


async def answer_question(question: str):
    """Async entrypoint for the CLI."""
    return await _GRAPH.ainvoke({"question": question, "iter": 0})


def answer_sync(question: str):
    """Blocking helper for unit-tests."""
    import asyncio

    return asyncio.run(answer_question(question))


def _cache_key(question: str, max_words: int, max_sources: int, recency, fmt) -> str:
    # controls change the answer, so they must be part of the cache identity
    return f"{question}::w{max_words}::s{max_sources}::r{recency or '-'}::f{fmt}"


def _normalize_citations(answer: str, citations: list) -> tuple[str, list]:
    """Make every [n] in the answer correspond to a real, deduped source.

    Goals:
      - dedupe sources by URL (first occurrence wins)
      - renumber 1..k in order of first reference inside the answer
      - drop orphan [n] markers (no matching source) so we never lie
      - if the model didn't cite at all, keep the answer and return the
        deduped sources as-is (still useful)
    """
    import re as _re

    if not citations:
        return answer, []

    by_url: dict[str, dict] = {}
    for c in citations:
        u = (c or {}).get("url")
        if u and u not in by_url:
            by_url[u] = c
    id_to_url = {c["id"]: c.get("url") for c in citations if c.get("url")}

    if not _re.search(r"\[\d+\]", answer):
        deduped = [
            {**c, "id": i + 1} for i, c in enumerate(by_url.values())
        ]
        return answer, deduped

    used_urls: list[str] = []
    seen: set[str] = set()
    for m in _re.finditer(r"\[(\d+)\]", answer):
        u = id_to_url.get(int(m.group(1)))
        if not u or u not in by_url or u in seen:
            continue
        seen.add(u)
        used_urls.append(u)

    url_to_new_id = {u: i + 1 for i, u in enumerate(used_urls)}

    def _repl(m):
        u = id_to_url.get(int(m.group(1)))
        return f"[{url_to_new_id[u]}]" if (u and u in url_to_new_id) else ""

    new_answer = _re.sub(r"\s?\[(\d+)\]", _repl, answer)
    new_answer = _re.sub(r"[ \t]+", " ", new_answer)
    new_answer = _re.sub(r"\s+([.,;:!?])", r"\1", new_answer).strip()

    final_citations = [
        {**by_url[u], "id": url_to_new_id[u]} for u in used_urls
    ]
    return new_answer, final_citations


async def astream_answer(
    question: str,
    history: Optional[str] = None,
    max_words: int = 80,
    max_sources: int = 3,
    recency: Optional[str] = None,
    fmt: str = "prose",
    nocache: bool = False,
) -> AsyncIterator[Dict[str, Any]]:
    """Run the pipeline and stream it as events for SSE/WebSocket.

    Event types: ``stage`` (live phase), ``queries`` (the searches run),
    ``token`` (streamed answer), ``coverage`` (Reflect slots filled/missing),
    ``followups`` (suggested next questions), ``done`` (answer+citations+trace),
    ``error``. Honours user controls (length / sources / recency / format) and
    serves a control-aware cached answer instantly when one exists.

    ``nocache=True`` (used by the Regenerate action) skips the cache *read*
    so the pipeline is genuinely re-run; the fresh answer is still written
    to cache at the end so the next normal ask returns it instantly.
    """
    import re as _re
    from opentelemetry import trace as _trace

    span = _trace.get_current_span()
    ctx = span.get_span_context() if span else None
    trace_id = format(ctx.trace_id, "032x") if ctx and ctx.trace_id else None

    max_sources = max(1, min(int(max_sources), 5))
    key = _cache_key(question, max_words, max_sources, recency, fmt)

    try:
        cached = None if nocache else await answer_cache_get(key)
        if cached and cached.get("answer"):
            for name in ("generate", "search", "reflect", "synthesize"):
                yield {"type": "stage", "name": name, "status": "done"}
            answer = cached["answer"]
            for tok in _re.findall(r"\S+\s*", answer):
                yield {"type": "token", "value": tok}
            yield {
                "type": "done",
                "answer": answer,
                "citations": cached.get("citations", []),
                "coverage": cached.get("coverage"),
                "followups": cached.get("followups", []),
                "cached": True,
                "trace_id": trace_id,
            }
            return

        state: Dict[str, Any] = {
            "question": question,
            "iter": 0,
            "max_words": max_words,
            "max_sources": max_sources,
            "fmt": fmt,
        }
        if history:
            state["history"] = history
        if recency:
            state["recency"] = recency

        yield {"type": "stage", "name": "generate", "status": "running"}
        state.update(await generate_node(state))
        yield {"type": "stage", "name": "generate", "status": "done"}
        yield {"type": "queries", "value": state.get("queries", [])}

        rounds = 0
        while True:
            yield {"type": "stage", "name": "search", "status": "running"}
            state.update(await search_node(state))
            yield {
                "type": "stage",
                "name": "search",
                "status": "done",
                "meta": {"docs": len(state.get("docs", []))},
            }
            yield {"type": "stage", "name": "reflect", "status": "running"}
            state.update(await reflect_node(state))
            yield {"type": "stage", "name": "reflect", "status": "done"}
            rounds += 1
            if not state.get("need_more") or rounds >= MAX_ITER:
                break

        # Reflect coverage — which required facts were found vs still missing
        slots = state.get("slots") or []
        filled = state.get("filled") or []
        coverage = (
            {"slots": slots, "filled": filled} if slots else None
        )
        if coverage:
            yield {"type": "coverage", "value": coverage}

        yield {"type": "stage", "name": "synthesize", "status": "running"}
        answer_parts: list[str] = []
        citations: list = []
        async for ev in synthesize_stream(state):
            if ev["type"] == "token":
                answer_parts.append(ev["value"])
                yield {"type": "token", "value": ev["value"]}
            elif ev["type"] == "citations":
                citations = ev["value"]
        yield {"type": "stage", "name": "synthesize", "status": "done"}

        answer = trim_words("".join(answer_parts).strip(), max_words)
        answer, citations = _normalize_citations(answer, citations)

        followups = await generate_followups(question, answer)
        if followups:
            yield {"type": "followups", "value": followups}

        await answer_cache_set(
            key,
            {
                "answer": answer,
                "citations": citations,
                "coverage": coverage,
                "followups": followups,
            },
        )
        yield {
            "type": "done",
            "answer": answer,
            "citations": citations,
            "coverage": coverage,
            "followups": followups,
            "cached": False,
            "trace_id": trace_id,
        }
    except Exception as e:  # never leak a stack trace to the client
        yield {
            "type": "error",
            "message": "The research run hit an error. Please try again.",
            "detail": str(e),
        }
