"""
LangGraph 0.5-compatible pipeline builder.
Implements: Generate ➜ Search ➜ Reflect (loop ≤2) ➜ Synthesize
"""

from typing import Dict, Any
from langgraph.graph import StateGraph

from .nodes import (
    generate_node,
    search_node,
    reflect_node,
    synthesize_node,
)

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
