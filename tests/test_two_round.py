from agent import answer_sync, nodes
from agent import graph as g


class ToggleReflect:
    """First call: need_more=True → loop;
    Second call: need_more=False → proceed to synthesize."""

    def __init__(self):
        self.count = 0

    async def __call__(self, state):
        self.count += 1
        need_more = self.count == 1  # only the first time
        # return minimal fields the router expects
        return {
            "question": state["question"],
            "queries": state.get("queries", []),
            "docs": state.get("docs", []),
            "need_more": need_more,
        }


def test_two_round(monkeypatch):
    toggle = ToggleReflect()

    # Patch BOTH locations
    monkeypatch.setattr(nodes, "reflect_node", toggle)
    monkeypatch.setattr(g, "reflect_node", toggle)

    # Re-compile so builder picks up the patched function
    g._GRAPH = g._build_graph()

    out = answer_sync("Two-round test?")
    assert "answer" in out and toggle.count == 2
