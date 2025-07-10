"""
Build and expose the LangGraph pipeline.
"""
from typing import Dict, Any
from langgraph.graph import StateGraph
from .nodes import generate_node, search_node, reflect_node, synthesize_node


def _build_graph():
    sg = StateGraph(Dict[str, Any])

    # Add nodes
    sg.add_node("generate", generate_node)
    sg.add_node("search", search_node)
    sg.add_node("reflect", reflect_node)
    sg.add_node("synthesize", synthesize_node)

    # Wire edges
    sg.set_entry_point("generate")
    sg.connect("generate", "search")
    sg.connect("search", "reflect")
    sg.connect("reflect", "search", condition=lambda s: s.get("need_more"))
    sg.connect("reflect", "synthesize", condition=lambda s: not s.get("need_more"))

    return sg.compile()


_GRAPH = _build_graph()


async def answer_question(question: str):
    return await _GRAPH.arun({"question": question})

# Synchronous convenience for unit tests
def answer_sync(question: str):
    import asyncio
    return asyncio.run(answer_question(question))