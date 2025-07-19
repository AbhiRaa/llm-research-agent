"""
Retry logic – the agent should survive a *single* HTTP‑429 (rate‑limit) error
emitted by the search tool and succeed on the second attempt.
"""
from agent import answer_sync
from agent import tools


class _Once:
    """Callable that raises on the first invocation, then behaves normally."""

    def __init__(self):
        self.first = True

    async def __call__(self, q):
        if self.first:
            self.first = False
            raise RuntimeError("HTTP 429")   # Mimic rate‑limit
        return await tools._mock_search(q)      # Success path


def test_retry_on_429(monkeypatch):
    # Patch *tools.web_search* so the pipeline hits our _Once wrapper.
    patcher = _Once()
    monkeypatch.setattr(tools, "web_search", patcher)
    
    out = answer_sync("Retry test?")
    assert "answer" in out
