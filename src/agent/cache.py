"""
Thin Redis wrapper that caches *JSON-serialisable* results.

* We convert LangChain ``Document`` objects to/from plain dicts so the
  cache is language-agnostic and human-readable.
* When REDIS_URL is missing or Redis is unreachable, the decorator
  becomes a no-op and simply calls the wrapped coroutine.
"""

from __future__ import annotations

import os, sys, json, asyncio
from typing import Any, Awaitable, Callable, List, Dict, TypedDict

import redis.asyncio as redis
from langchain.schema import Document

# ──────────────────────────────────────────────────────────────────────────
_REDIS_URL = os.getenv("REDIS_URL")
_pool: "redis.Redis | None" = None


async def get_redis() -> "redis.Redis | None":
    """
    Return a singleton Redis connection or ``None`` if Redis is unavailable.
    """
    global _pool
    if _pool is not None:
        return _pool

    if not _REDIS_URL:  # env var absent → no cache
        return None

    try:
        _pool = redis.from_url(_REDIS_URL, encoding="utf-8", decode_responses=True)
        await _pool.ping()  # cheap health-check
        return _pool
    except Exception as e:
        print(f"[cache] Redis unavailable → disable cache ({e})", file=sys.stderr)
        _pool = None
        return None


# ────────────────────────── helpers to (de)serialise docs ─────────────────
class _DocJSON(TypedDict):
    content: str
    title: str | None
    url: str | None


def _docs_to_json(docs: List[Document]) -> str:
    payload: List[_DocJSON] = [
        {
            "content": d.page_content,
            "title": (d.metadata or {}).get("title"),
            "url": (d.metadata or {}).get("url"),
        }
        for d in docs
    ]
    return json.dumps(payload)


def _docs_from_json(payload: str) -> List[Document]:
    raw: List[_DocJSON] = json.loads(payload)
    return [
        Document(page_content=d["content"], metadata={"title": d["title"], "url": d["url"]})
        for d in raw
    ]


def _maybe_encode(val: Any) -> str:
    """
    Supported return types:
      • list[Document]     -> JSON string
      • str / int / dict   -> json.dumps(val)
    """
    if isinstance(val, list) and val and isinstance(val[0], Document):
        return _docs_to_json(val)  # type: ignore[arg-type]
    return json.dumps(val)


def _maybe_decode(val: str) -> Any:
    try:
        data = json.loads(val)
        # Heuristic: list of dicts with 'content' & 'url' → treat as docs
        if (
            isinstance(data, list)
            and data
            and isinstance(data[0], dict)
            and "content" in data[0]
            and "url" in data[0]
        ):
            return _docs_from_json(val)
        return data
    except json.JSONDecodeError:
        return val  # shouldn’t happen


# ───────────────────────────────── decorator ──────────────────────────────
def cached(ttl: int = 300):
    """
    Decorator for async functions.  Example:

        @cached(ttl=3600)
        async def web_search(q: str) -> list[Document]: ...
    """

    def _wrap(func: Callable[..., Awaitable[Any]]):
        async def _inner(*args, **kwargs):
            key = f"{func.__name__}:{args}:{tuple(sorted(kwargs.items()))}"
            r = await get_redis()

            if r:
                cached_val = await r.get(key)
                if cached_val is not None:
                    return _maybe_decode(cached_val)

            result = await func(*args, **kwargs)

            if r:
                try:
                    await r.set(key, _maybe_encode(result), ex=ttl)
                except TypeError:
                    # Unsupported type → skip caching silently
                    pass
            return result

        return _inner

    return _wrap
