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

# Auth is via Bearer / X-API-Key / ?api_key — never cookies — so we don't need
# (and must not pair with a wildcard origin) credentialed CORS. allow_credentials
# stays False so `allow_origins=["*"]` is spec-compliant and the browser won't be
# asked to attach ambient credentials cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
# Stale buckets are evicted opportunistically so the dict can't grow without
# bound as distinct IPs/keys come and go (otherwise it's a slow memory leak).
_SWEEP_EVERY = 300.0
_last_sweep = 0.0

# In production the app sits behind a reverse proxy (HF Spaces, Vercel), so
# `request.client.host` is the *proxy* IP — every caller would collapse into one
# rate-limit bucket. When TRUST_PROXY is on we read the original client IP from
# X-Forwarded-For / X-Real-IP instead. Disable it for direct-exposure setups,
# where a client could otherwise spoof the header to dodge the limit.
_TRUST_PROXY = os.getenv("TRUST_PROXY", "1").lower() in ("1", "true", "yes")


def _real_ip(request_or_ws) -> str:
    """Best-effort original client IP, honouring proxy headers when trusted."""
    headers = getattr(request_or_ws, "headers", {})
    get = headers.get if hasattr(headers, "get") else (lambda *_: None)
    if _TRUST_PROXY:
        xff = get("x-forwarded-for")
        if xff:
            # leftmost entry is the original client the proxy saw
            first = xff.split(",")[0].strip()
            if first:
                return first
        real = get("x-real-ip")
        if real and real.strip():
            return real.strip()
    client = getattr(request_or_ws, "client", None)
    return (client and client.host) or "anon"


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

    return f"ip:{_real_ip(request_or_ws)}", _RATE_ANON, False


def _sweep(now: float) -> None:
    """Drop rate-limit buckets that have fully aged out, bounding memory."""
    global _last_sweep
    if now - _last_sweep < _SWEEP_EVERY:
        return
    _last_sweep = now
    stale = []
    for cid, q in _hits.items():
        while q and now - q[0] > _RATE_WINDOW:
            q.popleft()
        if not q:
            stale.append(cid)
    for cid in stale:
        _hits.pop(cid, None)


def _rate_limited(client_id: str, allowed: int) -> bool:
    now = time.time()
    _sweep(now)
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
async def debug(request: Request, question: str = "What is AI?"):
    if os.getenv("AGENT_DEBUG", "").lower() not in ("1", "true", "yes"):
        return JSONResponse({"error": "debug disabled"}, status_code=404)
    # Even gated behind AGENT_DEBUG, /debug runs the full (expensive) pipeline —
    # rate-limit it like the public endpoints so an enabled debug build can't be
    # hammered into resource exhaustion.
    cid, allowed, _ = _client_for(request)
    if _rate_limited(cid, allowed):
        return JSONResponse({"error": "rate limit exceeded"}, status_code=429)
    try:
        result = await answer_question(_clean_question(question) or "What is AI?")
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
        "history": _clean_text(params.get("history"), _MAX_HISTORY) or None,
        "max_words": _int("max_words", 80, 20, 400),
        "max_sources": _int("max_sources", 3, 1, 5),
        "recency": params.get("recency") if params.get("recency") in ("day", "week", "month") else None,
        "fmt": fmt if fmt in ("prose", "bullets", "tldr") else "prose",
        "nocache": str(params.get("nocache", "")).lower() in ("1", "true", "yes"),
    }


# ── input validation / abuse caps ──────────────────────────────────────────
# A research answer is ≤80 words, so any "question" past a couple thousand
# chars is abuse or a bug — cap it before it becomes a giant (costly) prompt.
_MAX_QUESTION = int(os.getenv("MAX_QUESTION_CHARS", "2000"))
_MAX_HISTORY = int(os.getenv("MAX_HISTORY_CHARS", "8000"))
# Hard ceiling on a /api/share body so a script can't junk-fill Redis.
_MAX_SHARE_BYTES = int(os.getenv("MAX_SHARE_BYTES", str(64 * 1024)))
_MAX_ANSWER_CHARS = 8000
_MAX_TITLE_CHARS = 300
_MAX_SNIPPET_CHARS = 600
_MAX_URL_CHARS = 2000
_MAX_CITATIONS = 12
_SAFE_URL_SCHEMES = ("http://", "https://")


def _clean_text(val, limit: int) -> str:
    """Coerce to a stripped, length-capped string (non-str → empty)."""
    if not isinstance(val, str):
        return ""
    return val.strip()[:limit]


def _clean_question(q) -> str:
    return _clean_text(q, _MAX_QUESTION)


def _safe_url(val) -> str:
    """Return the URL only if it uses a safe (http/https) scheme, else ''.

    Blocks javascript:/data:/vbscript: payloads from ever being persisted to a
    shared proof (defence-in-depth; the frontend guards href rendering too).
    """
    if not isinstance(val, str):
        return ""
    u = val.strip()[:_MAX_URL_CHARS]
    low = u.lower()
    if low == "local" or low.startswith(_SAFE_URL_SCHEMES):
        return u
    return ""


def _clean_share_payload(body) -> dict:
    """Validate + clamp a /api/share body; raise ValueError if unusable."""
    if not isinstance(body, dict):
        raise ValueError("payload must be an object")
    answer = _clean_text(body.get("answer"), _MAX_ANSWER_CHARS)
    if not answer:
        raise ValueError("answer required")

    raw_cites = body.get("citations")
    citations = []
    if isinstance(raw_cites, list):
        for i, c in enumerate(raw_cites[:_MAX_CITATIONS]):
            if not isinstance(c, dict):
                continue
            url = _safe_url(c.get("url"))
            if not url:
                continue
            try:
                cid = int(c.get("id", i + 1))
            except (TypeError, ValueError):
                cid = i + 1
            citations.append(
                {
                    "id": cid,
                    "title": _clean_text(c.get("title"), _MAX_TITLE_CHARS) or None,
                    "url": url,
                    "snippet": _clean_text(c.get("snippet"), _MAX_SNIPPET_CHARS) or None,
                }
            )

    return {
        "question": _clean_text(body.get("question"), _MAX_QUESTION),
        "answer": answer,
        "citations": citations,
        "created_at": time.time(),
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

    # Reject oversized bodies before parsing — both by the advertised
    # Content-Length and by the bytes actually read (a lying header is cheap).
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > _MAX_SHARE_BYTES:
        return JSONResponse({"error": "payload too large"}, status_code=413)
    raw = await request.body()
    if len(raw) > _MAX_SHARE_BYTES:
        return JSONResponse({"error": "payload too large"}, status_code=413)
    try:
        body = json.loads(raw)
    except Exception:
        return JSONResponse({"error": "invalid JSON"}, status_code=400)
    try:
        payload = _clean_share_payload(body)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    import secrets

    sid = secrets.token_urlsafe(8)
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
    q = _hits.get(cid)  # .get, not [] — don't materialise a bucket just to read it
    used = sum(1 for t in (q or ()) if now - t <= _RATE_WINDOW)
    return {"authed": authed, "used": used, "limit": allowed, "window_seconds": int(_RATE_WINDOW)}


@app.get("/api/stream")
async def sse_endpoint(question: str, request: Request):
    """Stream a research run as Server-Sent Events.

    Query params: ``question`` (required) plus the answer controls parsed by
    ``_controls`` (``history``, ``max_words``, ``max_sources``, ``recency``,
    ``fmt``, ``nocache``) and an optional ``api_key``. Emits ``event:`` frames
    of type ``stage``, ``queries``, ``token``, ``coverage``, ``followups``,
    ``done`` and ``error``. Rate-limited per caller; 400 on empty question.
    """
    cid, allowed, _ = _client_for(request)
    if _rate_limited(cid, allowed):
        return JSONResponse({"error": "rate limit exceeded, slow down"}, status_code=429)

    question = _clean_question(question)
    if not question:
        return JSONResponse({"error": "question required"}, status_code=400)

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
    """Stream a research run over WebSocket.

    Query param ``question`` (required) plus the same answer controls as
    ``/api/stream``. Sends each pipeline event as raw JSON. Close codes: 4000
    (missing question), 1013 (rate-limited), 1000 (completed normally).
    """
    await ws.accept()
    try:
        question = _clean_question(ws.query_params.get("question"))
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
