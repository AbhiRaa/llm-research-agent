"""
Simulate the “Reflect” node needing a second search round because a required
slot is missing on the first pass, then filled on the second.
"""
from agent import answer_sync, nodes


class FakeReflect:
    """Two‑step finite‑state machine to drive the LangGraph loop."""

    def __init__(self):
        self.calls = 0

    async def __call__(self, state):
        self.calls += 1
        if self.calls == 1:
            # First call → signal need_more=True so router loops
            return {
                **state,
                "slots": ["winner"],
                "filled": [],
                "need_more": True,
                "queries": ["winner 2022 World Cup"],
                "iter": state["iter"] + 1,
            }
        # Second call → all good, proceed to synthesize
        return {
            **state,
            "slots": ["winner"],
            "filled": ["winner"],
            "need_more": False,
        }


def test_slot_reflect(monkeypatch):
    monkeypatch.setattr(nodes, "reflect_node", FakeReflect())
    out = answer_sync("Who won the 2022 FIFA World Cup?")
    assert "answer" in out
