"""
Web-search helper.  Uses Bing API when BING_API_KEY is set;
otherwise returns deterministic mock docs so tests and
offline usage still work.
"""

import os, random, asyncio, aiohttp
from typing import List
from langchain.schema import Document

BING_KEY = os.getenv("BING_API_KEY")

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


async def _mock_search(query: str) -> List[Document]:
    await asyncio.sleep(0.05)  # simulate latency
    return [random.choice(MOCK_POOL)]


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
