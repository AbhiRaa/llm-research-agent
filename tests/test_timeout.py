import asyncio, pytest
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
