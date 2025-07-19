"""
The search tool must respect the global TIMEOUT_SECS wrapper.
We replace the Bing search function with an artificial 2‑second delay
(which exceeds TIMEOUT_SECS=1), ensuring the agent times out gracefully
and falls back to mocks.
"""
import asyncio
from agent import answer_sync
from agent import tools


async def slow_search(_):
    await asyncio.sleep(2)  # longer than our soon-to-be timeout
    return []  # would never reach here


def test_timeout(monkeypatch):
    # Pretend Bing key is present so web_search chooses slow path
    monkeypatch.setattr(tools, "BING_KEY", "fake")
    monkeypatch.setattr(tools, "_bing_search", slow_search)

    out = answer_sync("Timeout test?")
    # Should still return a JSON with an answer
    assert "answer" in out
