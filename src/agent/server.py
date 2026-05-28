import asyncio, json, os, time
from collections import defaultdict, deque
from typing import Optional

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .graph import answer_question, astream_answer
from .cache import share_get, share_set

app = FastAPI(title="PROOF — research agent (streaming)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── optional API-key auth + per-client sliding-window rate limiter ─────────
# `API_KEYS` is a comma-separated whitelist; if empty, the API is open and
# every caller falls through to the (lower) anonymous rate limit. A caller
# presenting a valid key gets the higher authed limit and is tracked
# independently in /api/usage.
_API_KEYS: set[str] = {
    k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()
}
_RATE_ANON = int(os.getenv("RATE_LIMIT_PER_MIN", "30"))
_RATE_AUTHED = int(os.getenv("RATE_LIMIT_AUTHED_PER_MIN", "120"))
_RATE_WINDOW = 60.0
_hits: dict[str, deque] = defaultdict(deque)


def _client_for(request_or_ws) -> tuple[str, int, bool]:
    """Return (client_id, allowed_per_min, is_authed) for this caller."""
    key = None
    # FastAPI Request exposes headers; WebSocket also has headers.
    headers = getattr(request_or_ws, "headers", {})
    auth = headers.get("authorization", "") if hasattr(headers, "get") else ""
    if auth.lower().startswith("bearer "):
        key = auth[7:].strip()
    if not key and hasattr(headers, "get"):
        key = (headers.get("x-api-key") or "").strip() or None
    if not key:
        # SSE/WS in browsers can't set headers easily → accept ?api_key=
        qp = getattr(request_or_ws, "query_params", None)
        if qp is not None:
            key = qp.get("api_key") or None

    if _API_KEYS and key and key in _API_KEYS:
        # short, opaque id so logs / metrics don't leak the key
        return f"key:{key[:6]}", _RATE_AUTHED, True

    ip = (
        getattr(request_or_ws, "client", None) and request_or_ws.client.host
    ) or "anon"
    return f"ip:{ip}", _RATE_ANON, False


def _rate_limited(client_id: str, allowed: int) -> bool:
    now = time.time()
    q = _hits[client_id]
    while q and now - q[0] > _RATE_WINDOW:
        q.popleft()
    if len(q) >= allowed:
        return True
    q.append(now)
    return False


@app.get("/health")
async def health():
    return {"status": "healthy"}


# /debug runs the full pipeline and exposes internals — only when explicitly
# enabled, so it can never leak tracebacks in production.
@app.get("/debug")
async def debug(question: str = "What is AI?"):
    if os.getenv("AGENT_DEBUG", "").lower() not in ("1", "true", "yes"):
        return JSONResponse({"error": "debug disabled"}, status_code=404)
    try:
        result = await answer_question(question)
        return {"success": True, "result": result}
    except Exception as e:
        import traceback

        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


# ---- SSE framing helpers --------------------------------------------------
def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


from opentelemetry import trace as _trace

_tracer = _trace.get_tracer(__name__)


def _controls(params) -> dict:
    """Parse + clamp the answer-control query params."""
    def _int(name, default, lo, hi):
        try:
            return max(lo, min(int(params.get(name, default)), hi))
        except (TypeError, ValueError):
            return default

    fmt = params.get("fmt", "prose")
    return {
        "history": params.get("history"),
        "max_words": _int("max_words", 80, 20, 400),
        "max_sources": _int("max_sources", 3, 1, 5),
        "recency": params.get("recency") if params.get("recency") in ("day", "week", "month") else None,
        "fmt": fmt if fmt in ("prose", "bullets", "tldr") else "prose",
        "nocache": str(params.get("nocache", "")).lower() in ("1", "true", "yes"),
    }


async def _event_stream(question: str, ctrls: dict):
    """Translate pipeline events into SSE frames (inside a trace span)."""
    try:
        with _tracer.start_as_current_span("request"):
            async for ev in astream_answer(question, **ctrls):
                t = ev["type"]
                if t == "token":
                    yield _sse("token", {"text": ev["value"]})
                elif t in ("queries", "coverage", "followups"):
                    yield _sse(t, {"value": ev["value"]})
                elif t in ("stage", "done", "error"):
                    yield _sse(t, {k: ev[k] for k in ev if k != "type"})
    except Exception as e:  # pragma: no cover - defensive
        print(f"[server] stream error: {e}")
        yield _sse("error", {"message": "Sorry, something went wrong."})


# ---- SSE endpoint ---------------------------------------------------------
@app.post("/api/share")
async def share_create(request: Request):
    """Publish an answer to a short opaque link."""
    cid, allowed, _ = _client_for(request)
    if _rate_limited(cid, allowed):
        return JSONResponse({"error": "rate limit exceeded"}, status_code=429)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    if not isinstance(body, dict) or not body.get("answer"):
        return JSONResponse({"error": "answer required"}, status_code=400)
    import secrets

    sid = secrets.token_urlsafe(8)
    payload = {
        "question": body.get("question", ""),
        "answer": body["answer"],
        "citations": body.get("citations", []),
        "created_at": time.time(),
    }
    if not await share_set(sid, payload):
        return JSONResponse(
            {"error": "share storage unavailable"}, status_code=503
        )
    return {"id": sid}


@app.get("/api/share/{sid}")
async def share_read(sid: str):
    p = await share_get(sid)
    if not p:
        return JSONResponse({"error": "not found"}, status_code=404)
    return p


@app.get("/api/usage")
async def usage(request: Request):
    """How much of the caller's rate window has been used (handy for clients)."""
    cid, allowed, authed = _client_for(request)
    now = time.time()
    q = _hits[cid]
    used = sum(1 for t in q if now - t <= _RATE_WINDOW)
    return {"authed": authed, "used": used, "limit": allowed, "window_seconds": int(_RATE_WINDOW)}


@app.get("/api/stream")
async def sse_endpoint(question: str, request: Request):
    cid, allowed, _ = _client_for(request)
    if _rate_limited(cid, allowed):
        return JSONResponse({"error": "rate limit exceeded, slow down"}, status_code=429)

    ctrls = _controls(request.query_params)

    async def _gen():
        async for chunk in _event_stream(question, ctrls):
            if await request.is_disconnected():
                break
            yield chunk

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # disable proxy buffering so tokens flush
    }
    return StreamingResponse(_gen(), headers=headers)


# ---- WebSocket endpoint ---------------------------------------------------
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        question = ws.query_params.get("question")
        if not question:
            await ws.close(code=4000)
            return
        cid, allowed, _ = _client_for(ws)
        if _rate_limited(cid, allowed):
            await ws.send_text(json.dumps({"type": "error", "message": "rate limit"}))
            await ws.close(code=1013)
            return

        ctrls = _controls(ws.query_params)
        with _tracer.start_as_current_span("request"):
            async for ev in astream_answer(question, **ctrls):
                await ws.send_text(json.dumps(ev))
                if ev["type"] in ("done", "error"):
                    await ws.close(code=1000)
                    return
    except WebSocketDisconnect:
        pass


# ── single-deploy: serve the built frontend from the same origin ──────────
# If WEB_DIST_DIR exists (typically baked in by the Dockerfile), mount it at
# "/" with SPA fallback so client-side routes like /share/<id> resolve to
# index.html and the React app handles them.
class _SPAFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


_WEB_DIST = os.getenv("WEB_DIST_DIR", "/app/web")
if os.path.isdir(_WEB_DIST):
    app.mount("/", _SPAFiles(directory=_WEB_DIST, html=True), name="web")
