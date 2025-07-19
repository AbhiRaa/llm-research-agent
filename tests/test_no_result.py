"""
Edge‑case: web search returns **zero** documents.

The LLM must still synthesise an answer (using prior knowledge / parametrics)
and the pipeline must not crash.
"""
from agent import answer_sync


def test_no_docs(monkeypatch):
    # Monkeypatch web_search to always return []
    from agent import nodes

    async def empty(_):
        return []

    # Force *nodes.web_search* to return an empty list
    monkeypatch.setattr(nodes, "web_search", empty)

    out = answer_sync("Does the moon have lava?")
    # We still expect an answer (LLM can handle empty evidence)
    assert "answer" in out and isinstance(out["citations"], list)
