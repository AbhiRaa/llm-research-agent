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

**Gotcha — the `iter` counter and `MAX_ITER`.** `reflect_node` (nodes.py) is the *single* place that advances `state["iter"]` (and it force-clears `need_more` once `iter >= MAX_ITER - 1`); `route_after_reflect` (graph.py) only *reads* it. It used to increment too — that double-count made the compiled graph (CLI path) hit the budget a round early and never re-search, so the increment was removed; the streaming path (`astream_answer`) was always correct because it uses its own `rounds` counter. `MAX_ITER = 2` is still defined separately in each file, so keep them in sync when changing loop depth.

### Graceful degradation (the core pattern)
Every external dependency has a deterministic fallback, gated by env vars:
- **LLM** (`nodes.py`): `call_llm` uses `ChatOpenAI` (default `gpt-4o-mini`, override via `OPENAI_MODEL`; it's cheaper *and* better at JSON than the old gpt-3.5-turbo) only if `OPENAI_API_KEY` is set, and even then falls back to `_offline_stub` on rate-limit/auth/API errors. With no key, `_offline_stub` is used unconditionally. The stub branches on kwargs (`ctx` → Reflect JSON, `e` → Synthesize text, else → Generate query list) — keep these kwarg names consistent when editing prompts.
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
FastAPI app with permissive CORS (`allow_origins=["*"]`, **`allow_credentials=False`** — auth is via Bearer / `X-API-Key` / `?api_key`, never cookies, so wildcard origin stays spec-compliant). `/api/stream` (SSE) and `/api/ws` (WebSocket) both consume `astream_answer` and forward its events (SSE uses `event:`/`data:` frames; WS sends the raw event JSON). Each request runs inside a single OTel root span so the `trace_id` in `done` is meaningful. **Input caps**: `question` is stripped + length-capped (`_clean_question`, `MAX_QUESTION_CHARS` default 2000; empty → 400) on every entrypoint. **Auth + rate limiting**: optional `API_KEYS` (comma-separated) — callers presenting a matching `Authorization: Bearer …` header, `X-API-Key`, or `?api_key=` query param get the authed limit (`RATE_LIMIT_AUTHED_PER_MIN`, default 120); everyone else falls through to the per-client anonymous limit (`RATE_LIMIT_PER_MIN`, default 30). The client IP comes from `X-Forwarded-For`/`X-Real-IP` when `TRUST_PROXY=1` (default — the app sits behind HF/Vercel proxies; otherwise every caller collapses into one bucket), and `_sweep` evicts fully-aged-out buckets so the in-memory `_hits` map can't grow unbounded. `GET /api/usage` reports the current caller's used/limit (without materialising a bucket). `/debug` runs the full pipeline and exposes tracebacks, so it is **gated behind `AGENT_DEBUG=1`** (404 otherwise) **and is itself rate-limited**. `POST /api/share` publishes an answer payload under an opaque short id — the body is size-capped (`MAX_SHARE_BYTES`, default 64 KB), type/field-validated and clamped, and every citation URL is http(s)-only validated server-side (`_safe_url`) so a poisoned payload can't junk-fill Redis or smuggle a `javascript:` link; `GET /api/share/{id}` returns it (TTL 7 days; falls back to 503 when Redis is unavailable). `/health` is diagnostic.

**Single-deploy**: when `WEB_DIST_DIR` points at a built SPA (default `/app/web`, populated by the multi-stage Dockerfile), the app mounts a `_SPAFiles(StaticFiles)` at `/` that falls back to `index.html` on 404 — so client-side routes like `/share/<id>` resolve to the React app and the API + UI ship in one container.

## Layout & Deployment

- `src/agent/` — all backend code (cli, graph, nodes, tools, cache, observability, server).
- `web-agent/` — Vite + React chat UI, branded **PROOF**, in a Risograph/editorial style (Bricolage Grotesque + Newsreader + Space Mono; cobalt × flame on newsprint). The design system lives in `src/index.css` as CSS variables + bespoke classes (`.paper-card`, `.riso-title`, `.grain`, `.q-card`, etc.). `useStream.ts` consumes the SSE `stage`/`queries`/`token`/`coverage`/`followups`/`done`/`error` events, holds the answer **controls** (`proof-controls`: length/sources/recency/format) and sends them as query params, builds the `history` param for multi-turn, and exposes `regenerate`. It also owns **session state**: a list of `SessionMeta` (`proof-sessions`), an active id (`proof-active-session`), and per-session messages (`proof-msgs-<id>`); it migrates the legacy `proof-conversation` key on first load. **Cold-start + resilience** (in `run`): a `waking` flag is set after a short grace period so the sleeping free-tier backend shows a "waking the server" hint instead of a frozen pipeline; a pre-data connection error is treated as transient (let EventSource retry, bounded by a hard timeout) while a *post-data* drop is finalized rather than re-run (so a billable stream is never silently replayed); and a stale-stream guard (`activeAssistantRef`) stops a superseded stream — after a session switch / Stop / re-ask — from clobbering the new state. `Sidebar.tsx` is the archive drawer (new / switch / rename / delete). `Settings.tsx` is the header "print settings" popover — on mobile (`max-width: 640px`) it renders as a **bottom sheet portaled to `document.body`** (escaping the header's `backdrop-filter` containing block, which would otherwise anchor a `position:fixed` child to the header) and closes on Esc / backdrop tap. `Message.tsx` renders inline markdown + footnote citations + source favicons (hover → snippet), a coverage bar, a "show the work" panel (queries + optional Jaeger trace link, gated on `VITE_JAEGER_URL`), follow-up chips, **Share** (POST `/api/share` → copies `/share/<id>` to clipboard) and **Listen** (`speechSynthesis`) actions. `ChatInput.tsx` adds a **mic** button using `SpeechRecognition` (feature-detected, hidden on Firefox). `SharedView.tsx` renders the read-only published proof at `/share/<id>` — `App.tsx` short-circuits to it via a pathname match (no router needed). `@media print` + `.no-print` power the header's "Print proof" (PDF) action. **Tailwind gotcha:** the CSS uses v3 `@tailwind` directives under the v4 engine, so some utilities (preflight button reset, `grid-cols-*`) silently don't emit — buttons get an explicit reset in the base layer and the question grid uses an inline `repeat(auto-fit,…)` instead of `grid-cols-*`. Prefer custom CSS classes / inline styles over exotic utilities here.
- `tests/` — deterministic pytest scenarios (happy, no-result, http429, timeout, two-round, slot-reflect). `test_cli_stub` sets the API keys to `""` (not pop) in the child env so `load_dotenv` can't refill them — keep it that way or the test goes flaky against the network.

**Env vars:** `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), `SERPER_API_KEY`/`BING_API_KEY`, `REDIS_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `AGENT_DEBUG` (enables `/debug`), `RATE_LIMIT_PER_MIN` (anon, default 30), `RATE_LIMIT_AUTHED_PER_MIN` (authed, default 120), `API_KEYS` (comma-separated whitelist; empty = open), `TRUST_PROXY` (read client IP from proxy headers, default `1`), `MAX_QUESTION_CHARS` (default 2000), `MAX_HISTORY_CHARS` (default 8000), `MAX_SHARE_BYTES` (default 65536), `WEB_DIST_DIR` (single-deploy SPA path, default `/app/web`). Frontend: `VITE_API_BASE_URL` (empty in single-deploy → relative URLs), optional `VITE_JAEGER_URL` (per-answer "view trace" link).

**CI**: `.github/workflows/ci.yml` runs `pytest` + frontend lint+build on every push/PR, plus a gated `deploy-hf` job that ships the backend to HF on `production` pushes (see below). **E2E**: Playwright config in `web-agent/playwright.config.ts`, smoke specs in `web-agent/e2e/` (`npm run e2e:install` once, then `npm run e2e`).

**Observability:** `docker compose up -d jaeger otel-collector` then view traces at http://localhost:16686 — the collector exports to Jaeger via OTLP (`otel.yaml`).

**Live deployment** (all free-tier): the **SPA** auto-deploys to **Vercel** from the `production` branch — `vercel.json` at repo root + at `web-agent/` set `VITE_API_BASE_URL=https://AbhiRaa-proof.hf.space` so the SPA calls the backend cross-origin (CORS is `*`). Public URL is `https://proof.abhira.dev` (Vercel custom domain via GoDaddy CNAME → `cname.vercel-dns.com`). The **agent backend** runs on **Hugging Face Spaces** (`AbhiRaa/proof`, Docker SDK) using the multi-stage `Dockerfile`. HF is **not** git-synced from GitHub, but the `deploy-hf` CI job now **auto-deploys** it after tests pass on each `production` push by running `scripts/deploy_hf.py` (needs an `HF_TOKEN` repo secret; the job no-ops with a warning if it's unset). To deploy by hand: `python scripts/deploy_hf.py` (uses `HF_TOKEN` or your cached `huggingface-cli login`). Both call `HfApi.upload_folder` and **deliberately exclude `README.md`** — the Space keeps its *own* frontmatter README (`app_port: 7860`, `sdk: docker`) that HF reads for config and the Dockerfile `COPY README.md .` relies on; uploading the repo's project README would clobber it and break the Space. (Tests, docs, `node_modules`, `dist`, and local env files are excluded too.) The Space needs `PORT=7860` (variable, matches `app_port: 7860` in its README frontmatter) and `PROM_PORT=9100` (so Prom doesn't clash with uvicorn on 8000), plus `OPENAI_API_KEY`/`SERPER_API_KEY`/`REDIS_URL` as **secrets** (`api.add_space_secret(...)`). The `REDIS_URL` secret points at **Upstash Redis** (`rediss://…upstash.io:6379`) which powers the answer cache + share permalinks. Feature work happens on `feat/*` branches; `main` is the default integration branch.
