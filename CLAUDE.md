# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A research agent that answers any question in ≤80 words and always cites sources. The pipeline is **Generate → Search → Reflect (≤2 loops) → Synthesize**, built on LangGraph. The defining design principle is **graceful degradation**: the entire system runs offline with no API keys (stub LLM + mock search), and progressively upgrades to real services as env vars are provided. This is what makes CI deterministic and keyless.

## Commands

All Python commands require `src/` on the path. `tests/conftest.py` adds it automatically for pytest; for everything else use `PYTHONPATH=src`.

```bash
# Tests (deterministic, no keys/network needed)
pytest -q                          # full suite
pytest tests/test_two_round.py -q  # single file
pytest tests/test_two_round.py::test_two_round   # single test

# CLI (one-shot question → pretty JSON)
PYTHONPATH=src python -m agent.cli "Who won the 2022 FIFA World Cup?"

# Streaming API server (SSE + WebSocket on :8001, Prometheus on :8000)
PYTHONPATH=src uvicorn agent.server:app --host=0.0.0.0 --port=8001 --reload

# Format (black + isort are in requirements)
black src tests && isort src tests

# Full stack via Docker (agent + redis + otel-collector)
docker compose up -d redis otel-collector agent

# Frontend (Vite + React)
cd web-agent && npm install && npm run dev   # http://localhost:5173
cd web-agent && npm run lint                 # eslint
cd web-agent && npm run build                # vite build (skips tsc by design)
```

## Architecture

### Pipeline graph (`graph.py` + `nodes.py`)
LangGraph `StateGraph` over a plain `Dict[str, Any]` state. Four async nodes registered in `graph.py`; their logic lives in `nodes.py`. Static edges `generate → search → reflect`, then a conditional edge `route_after_reflect` loops back to `search` while `need_more` is true and the iteration budget (`MAX_ITER = 2`) is not exhausted, otherwise proceeds to `synthesize`. The compiled graph is a module-level singleton (`_GRAPH`). Public entrypoints: `answer_question` (async) and `answer_sync` (wraps it in `asyncio.run`, used by tests).

**Gotcha — the `iter` counter is mutated in two places.** Both `reflect_node` (nodes.py) and `route_after_reflect` (graph.py) increment `state["iter"]`, and `MAX_ITER = 2` is defined separately in each file. When changing loop behavior, account for both increments or the loop will terminate a round earlier/later than expected.

### Graceful degradation (the core pattern)
Every external dependency has a deterministic fallback, gated by env vars:
- **LLM** (`nodes.py`): `call_llm` uses `ChatOpenAI` (gpt-3.5-turbo) only if `OPENAI_API_KEY` is set, and even then falls back to `_offline_stub` on rate-limit/auth/API errors. With no key, `_offline_stub` is used unconditionally. The stub branches on kwargs (`ctx` → Reflect JSON, `e` → Synthesize text, else → Generate query list) — keep these kwarg names consistent when editing prompts.
- **Search** (`tools.py`): tries Bing (`BING_API_KEY`) then Serper (`SERPER_API_KEY`), each with an **8s** timeout (was 1s — too aggressive, it sent every live query to mock) and ≤2 retries with backoff on 429/timeout, then falls back to `_mock_search` (deterministic doc chosen by hashing the query). Result parsing uses `.get()` with fallbacks and skips entries without a URL (a missing `snippet` used to raise `KeyError` and dump valid results to mock). The except clause is broad (`aiohttp.ClientError`/`Exception`) so transient network errors degrade to mock instead of crashing a node. `_web_search_uncached` is the same logic without the Redis layer, for tests/benchmarks.
- **Cache** (`cache.py`): the `@cached(ttl=...)` decorator becomes a **no-op** when `REDIS_URL` is unset or Redis is unreachable. It serializes LangChain `Document`s to/from JSON dicts so cache entries are human-readable; `_maybe_decode` heuristically reconstructs `Document`s from any list-of-dicts containing `content` + `url` keys.
- **Observability** (`observability.py`): `init()` is idempotent and called once via `agent/__init__.py` on first import, so spans/metrics emit for every CLI run and test. It deliberately self-disables fragile parts under pytest: the OTLP exporter is skipped unless the collector hostname resolves AND `PYTEST_CURRENT_TEST` is absent; a busy Prometheus port (errno 48/98) is swallowed rather than raising. Failures inside nodes set span status ERROR but never crash the pipeline.

This means tests patch nodes directly (see `test_two_round.py`, `test_slot_reflect.py`) rather than mocking network — they swap `reflect_node` to drive the loop deterministically. Note that monkeypatching a node must patch it in **both** `agent.nodes` and `agent.graph` and then rebuild the graph (`g._GRAPH = g._build_graph()`), because `graph.py` imports the node functions by reference at build time.

### Streaming pipeline (`graph.py::astream_answer`)
`astream_answer(question, history, max_words=80, max_sources=3, recency=None, fmt="prose")` is the streaming entrypoint used by the server. It runs the nodes manually (generate → search/reflect loop → synthesize) and **yields events** rather than returning a final dict:
- `{"type":"stage","name":...,"status":"running"|"done","meta":{docs}}` — real per-phase progress (the frontend pipeline reflects these, not a timer).
- `{"type":"queries","value":[...]}` — the searches actually run ("show the work").
- `{"type":"token","value":...}` — synthesize streamed token-by-token via `synthesize_stream`/`call_llm_stream` in nodes.py (real LLM tokens with a key; the offline stub streams word-by-word so behavior is identical keyless).
- `{"type":"coverage","value":{slots,filled}}` — the Reflect step's required facts vs. those the evidence covered.
- `{"type":"followups","value":[...]}` — 2 suggested next questions (`generate_followups`, real-LLM only).
- `{"type":"done","answer","citations","coverage","followups","cached","trace_id"}` / `{"type":"error","message"}`.

**Answer controls** flow through state: `max_words` (enforced by `trim_words`, not just prompted), `max_sources` (fetch + cite count), `fmt` (prose/bullets/tldr), `recency` (→ Serper `tbs=qdr:*`). The **full-answer cache** key includes all controls (`cache.py::answer_cache_get/set`) — otherwise a 40-word answer could be served for a 150-word request. `answer_question`/`answer_sync` (non-streaming) still exist for the CLI and tests. **Multi-turn memory**: `history` is threaded into `generate_node`. Robustness: `_extract_json` (strips ```fences, digs out the first `{}`/`[]` block) is used by `reflect_node` and `generate_followups` because gpt-3.5 often wraps JSON in prose or a differently-keyed object; `generate_node` similarly falls back to the raw question so search never runs empty.

### Serving (`server.py`)
FastAPI app with permissive CORS. `/api/stream` (SSE) and `/api/ws` (WebSocket) both consume `astream_answer` and forward its events (SSE uses `event:`/`data:` frames; WS sends the raw event JSON). Each request runs inside a single OTel root span so the `trace_id` in `done` is meaningful. **Auth + rate limiting**: optional `API_KEYS` (comma-separated) — callers presenting a matching `Authorization: Bearer …` header, `X-API-Key`, or `?api_key=` query param get the authed limit (`RATE_LIMIT_AUTHED_PER_MIN`, default 120); everyone else falls through to the per-IP anonymous limit (`RATE_LIMIT_PER_MIN`, default 30). `GET /api/usage` reports the current caller's used/limit. `/debug` runs the full pipeline and exposes tracebacks, so it is **gated behind `AGENT_DEBUG=1`** (returns 404 otherwise). `POST /api/share` publishes an answer payload under an opaque short id, `GET /api/share/{id}` returns it (TTL 7 days; falls back to 503 when Redis is unavailable). `/health` is diagnostic.

**Single-deploy**: when `WEB_DIST_DIR` points at a built SPA (default `/app/web`, populated by the multi-stage Dockerfile), the app mounts a `_SPAFiles(StaticFiles)` at `/` that falls back to `index.html` on 404 — so client-side routes like `/share/<id>` resolve to the React app and the API + UI ship in one container.

## Layout & Deployment

- `src/agent/` — all backend code (cli, graph, nodes, tools, cache, observability, server).
- `web-agent/` — Vite + React chat UI, branded **PROOF**, in a Risograph/editorial style (Bricolage Grotesque + Newsreader + Space Mono; cobalt × flame on newsprint). The design system lives in `src/index.css` as CSS variables + bespoke classes (`.paper-card`, `.riso-title`, `.grain`, `.q-card`, etc.). `useStream.ts` consumes the SSE `stage`/`queries`/`token`/`coverage`/`followups`/`done`/`error` events, holds the answer **controls** (`proof-controls`: length/sources/recency/format) and sends them as query params, builds the `history` param for multi-turn, and exposes `regenerate`. It also owns **session state**: a list of `SessionMeta` (`proof-sessions`), an active id (`proof-active-session`), and per-session messages (`proof-msgs-<id>`); it migrates the legacy `proof-conversation` key on first load. `Sidebar.tsx` is the archive drawer (new / switch / rename / delete). `Settings.tsx` is the header "print settings" popover. `Message.tsx` renders inline markdown + footnote citations + source favicons (hover → snippet), a coverage bar, a "show the work" panel (queries + optional Jaeger trace link, gated on `VITE_JAEGER_URL`), follow-up chips, **Share** (POST `/api/share` → copies `/share/<id>` to clipboard) and **Listen** (`speechSynthesis`) actions. `ChatInput.tsx` adds a **mic** button using `SpeechRecognition` (feature-detected, hidden on Firefox). `SharedView.tsx` renders the read-only published proof at `/share/<id>` — `App.tsx` short-circuits to it via a pathname match (no router needed). `@media print` + `.no-print` power the header's "Print proof" (PDF) action. **Tailwind gotcha:** the CSS uses v3 `@tailwind` directives under the v4 engine, so some utilities (preflight button reset, `grid-cols-*`) silently don't emit — buttons get an explicit reset in the base layer and the question grid uses an inline `repeat(auto-fit,…)` instead of `grid-cols-*`. Prefer custom CSS classes / inline styles over exotic utilities here.
- `tests/` — deterministic pytest scenarios (happy, no-result, http429, timeout, two-round, slot-reflect). `test_cli_stub` sets the API keys to `""` (not pop) in the child env so `load_dotenv` can't refill them — keep it that way or the test goes flaky against the network.

**Env vars:** `OPENAI_API_KEY`, `SERPER_API_KEY`/`BING_API_KEY`, `REDIS_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `AGENT_DEBUG` (enables `/debug`), `RATE_LIMIT_PER_MIN` (anon, default 30), `RATE_LIMIT_AUTHED_PER_MIN` (authed, default 120), `API_KEYS` (comma-separated whitelist; empty = open), `WEB_DIST_DIR` (single-deploy SPA path, default `/app/web`). Frontend: `VITE_API_BASE_URL` (empty in single-deploy → relative URLs), optional `VITE_JAEGER_URL` (per-answer "view trace" link).

**CI**: `.github/workflows/ci.yml` runs `pytest` + frontend lint+build on every push/PR. **E2E**: Playwright config in `web-agent/playwright.config.ts`, smoke specs in `web-agent/e2e/` (`npm run e2e:install` once, then `npm run e2e`).

**Observability:** `docker compose up -d jaeger otel-collector` then view traces at http://localhost:16686 — the collector exports to Jaeger via OTLP (`otel.yaml`).

Deployment is branch-based: **backend** deploys from the `production` branch to Railway (uses `Dockerfile` + `start.sh`, which reads `$PORT` and runs uvicorn). **Frontend** deploys to Vercel with root dir `web-agent/`. Feature work happens on `feat/*` branches; `main` is the default integration branch. `test_server.py` is a throwaway minimal server used only for debugging Railway boot issues — not part of the agent.
