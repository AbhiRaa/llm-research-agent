import pytest, asyncio
from agent import answer_sync
from agent import tools


class _Once:
    """Helper to raise on first call, succeed on second."""

    def __init__(self):
        self.first = True

    async def __call__(self, q):
        if self.first:
            self.first = False
            raise RuntimeError("HTTP 429")  # mimics rate-limit
        return await tools._mock_search(q)


def test_retry_on_429(monkeypatch):
    patcher = _Once()
    monkeypatch.setattr(tools, "web_search", patcher)
    out = answer_sync("Retry test?")
    assert "answer" in out
