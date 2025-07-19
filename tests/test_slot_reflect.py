import json
from agent import answer_sync, nodes


class FakeReflect:
    """Force missing slot on first round, filled on second."""

    def __init__(self):
        self.calls = 0

    async def __call__(self, state):
        self.calls += 1
        if self.calls == 1:
            return {
                **state,
                "slots": ["winner"],
                "filled": [],
                "need_more": True,
                "queries": ["winner 2022 World Cup"],
                "iter": state["iter"] + 1,
            }
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
