"""
Web-search helper.  Uses Bing API when BING_API_KEY is set;
otherwise returns deterministic mock docs so tests and
offline usage still work.
"""

import os, random, asyncio, aiohttp, json
from typing import List
from langchain.schema import Document
from dotenv import load_dotenv
from .cache import cached

load_dotenv()  # load .env file if present

BING_KEY = os.getenv("BING_API_KEY")
SERPER_KEY = os.getenv("SERPER_API_KEY")

TIMEOUT_SECS = 1.0  # short because we retry/fallback quickly

# --- Mock fallback ----------------------------------------------------------
MOCK_POOL = [
    Document(
        page_content="Argentina won the 2022 FIFA World Cup, beating France on penalties.",
        metadata={
            "title": "Argentina triumph in Qatar",
            "url": "https://example.com/argentina",
        },
    ),
    Document(
        page_content="HPA scales pods on CPU/Memory, whereas KEDA scales on 50+ event sources.",
        metadata={"title": "HPA vs KEDA", "url": "https://example.com/keda"},
    ),
]

# Ensure the mock pool is deterministic
def _stable_choice(query: str) -> Document:
    """Pick a mock doc deterministically based on the query."""
    idx = abs(hash(query)) % len(MOCK_POOL)
    return MOCK_POOL[idx]

async def _mock_search(query: str) -> List[Document]:
    await asyncio.sleep(0.05)          # simulate latency
    return [_stable_choice(query)]


# --- Real Bing call ---------------------------------------------------------
async def _bing_search(query: str) -> List[Document]:
    url = "https://api.bing.microsoft.com/v7.0/search"
    headers = {"Ocp-Apim-Subscription-Key": BING_KEY}
    params = {"q": query, "count": 5}
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, params=params, timeout=10) as resp:
            if resp.status == 429:  # rate-limit
                raise RuntimeError("HTTP 429 from Bing")
            data = await resp.json()
    docs = []
    for item in data.get("webPages", {}).get("value", []):
        docs.append(
            Document(
                page_content=item["snippet"],
                metadata={"title": item["name"], "url": item["url"]},
            )
        )
    return docs


# --- Public API -------------------------------------------------------------
async def web_search(query: str, retries: int = 2) -> List[Document]:
    """
    Run Bing search with:
    • global TIMEOUT_SECS per request
    • up to `retries` retry attempts on HTTP 429 or timeout
    Falls back to mock search if Bing fails or no API key is set.
    """
    attempt = 0
    while True:
        try:
            if BING_KEY:
                return await asyncio.wait_for(_bing_search(query), TIMEOUT_SECS)
        except (asyncio.TimeoutError, RuntimeError) as e:
            # Retry only for timeout or explicit HTTP 429 signal
            if attempt < retries and (
                "429" in str(e) or isinstance(e, asyncio.TimeoutError)
            ):
                attempt += 1
                await asyncio.sleep(0.2 * attempt)  # back-off
                continue
        # Either no Bing key, retries exhausted, or other error → mock
        return await _mock_search(query)


# ---------------------------------------------------------------------------
# NEW: real Google SERP via Serper.dev
async def _serper_search(query: str) -> List[Document]:
    """
    Call Serper.dev (Google Search API) and return top 5 organic snippets.
    Requires SERPER_API_KEY env-var.
    """
    if not SERPER_KEY:
        raise RuntimeError("No SERPER_API_KEY")
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"}
    payload = {"q": query, "num": 5}

    async with aiohttp.ClientSession() as sess:
        async with sess.post(url, headers=headers, json=payload, timeout=10) as resp:
            if resp.status == 429:
                raise RuntimeError("HTTP 429 from Serper")
            if resp.status != 200:
                raise RuntimeError(f"Serper {resp.status}")
            data = await resp.json()

    docs: List[Document] = []
    for item in data.get("organic", []):
        docs.append(
            Document(
                page_content=item["snippet"],
                metadata={"title": item["title"], "url": item["link"]},
            )
        )
    return docs


# --- Public API -------------------------------------------------------------
@cached(ttl=3600)        # 1-hour cache
async def web_search(query: str, retries: int = 2) -> List[Document]:
    """
    Try Bing first (if key present), else Serper.dev, both with:
    • 1-second timeout wrapper
    • up to `retries` retry attempts on HTTP 429 or timeout
    Fall back to deterministic mock docs when everything fails.
    """
    attempt = 0
    while True:
        try:
            if BING_KEY:
                return await asyncio.wait_for(_bing_search(query), TIMEOUT_SECS)
            if SERPER_KEY:
                return await asyncio.wait_for(_serper_search(query), TIMEOUT_SECS)
        except (asyncio.TimeoutError, RuntimeError) as e:
            if attempt < retries and (
                "429" in str(e) or isinstance(e, asyncio.TimeoutError)
            ):
                attempt += 1
                await asyncio.sleep(0.2 * attempt)
                continue
        # No key, retries exhausted, or other error -> mock
        return await _mock_search(query)
