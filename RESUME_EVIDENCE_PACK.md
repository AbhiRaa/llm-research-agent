# Resume Evidence Pack — PROOF

> Live: **https://proof.abhira.dev** · Source: **https://github.com/AbhiRaa/llm-research-agent** · Backend Space: **https://huggingface.co/spaces/AbhiRaa/proof**

## 1) Project Overview (5–10 lines)
- **PROOF** is a production-grade research agent that answers any question in ≤80 words and grounds every claim in a real, deduplicated source — runs end-to-end **offline** for CI (stub LLM + mock search) and progressively upgrades to real OpenAI + Serper as env vars appear (`src/agent/nodes.py`, `src/agent/tools.py`).
- **LangGraph pipeline** — Generate → Search → Reflect (≤2 loops) → Synthesize — exposed both as a one-shot CLI and as a **real token-streaming SSE/WebSocket API** that emits `stage` / `queries` / `token` / `coverage` / `followups` / `done` events for live UI rendering (`src/agent/graph.py::astream_answer`, `src/agent/server.py`).
- **Risograph-styled React/Vite SPA** ("PROOF") with multi-turn memory, an answer-controls popover (length / sources / recency / format), transparency widgets (coverage bar, "show the work"), follow-up chips, source favicons + hover snippets, shareable permalinks, voice input/read-aloud, sessions sidebar and print-to-PDF (`web-agent/src/`).
- **Production hardening** — full-answer cache keyed on question + controls (Upstash Redis), per-IP and per-API-key rate limits, gated `/debug`, shareable links endpoint, citation validator that dedupes URLs and renumbers `[n]` markers so hallucinated citations can't reach the UI (`src/agent/graph.py::_normalize_citations`, `src/agent/server.py`, `src/agent/cache.py`).
- **Observability** — OpenTelemetry root span per request (trace id surfaces in the `done` event), Prometheus counters/histograms per phase, and a one-command local Jaeger UI via Docker Compose (`src/agent/observability.py`, `compose.yaml`, `otel.yaml`).
- **Single-deploy on free tier** — multi-stage Dockerfile builds the SPA in node and serves it from FastAPI via an SPA-fallback StaticFiles mount; deployed live as **Vercel SPA + Hugging Face Spaces backend + Upstash Redis**, fronted by a custom GoDaddy CNAME (`Dockerfile`, `src/agent/server.py::_SPAFiles`).

## 2) Architecture & Components
- **Backend** (1 391 LOC Python, 7 endpoints):
  - `src/agent/graph.py` — `astream_answer(question, history, max_words, max_sources, recency, fmt)` async generator orchestrates generate → search/reflect loop → synthesize, emitting typed events for SSE/WS. Includes `_normalize_citations` (dedupe by URL + renumber `[n]` markers + drop orphans) and `_cache_key` (controls baked into cache identity).
  - `src/agent/nodes.py` — 4 node functions + 3 streaming helpers (`call_llm_stream`, `synthesize_stream`, `generate_followups`) + `_extract_json` (gpt-3.5-tolerant JSON parser used by Reflect and follow-ups) + `trim_words` (hard-enforces `max_words` budget).
  - `src/agent/server.py` — FastAPI with SSE/WS streaming, optional Bearer/`?api_key=` auth (`API_KEYS` env), sliding-window per-client rate limit (anon 30/min, authed 120/min, `GET /api/usage`), shareable permalinks (`POST /api/share`, `GET /api/share/{id}`), `_SPAFiles(StaticFiles)` for single-deploy, gated `/debug`.
  - `src/agent/tools.py` — Bing/Serper with 8 s timeout + 2 retries on 429/timeout + broadened (`aiohttp.ClientError`/`Exception`) catch-all → deterministic mock fallback. Serper `recency` maps to `tbs=qdr:*` for fresh-result queries.
  - `src/agent/cache.py` — `@cached` decorator that's a no-op without Redis; serialises LangChain `Document`s as JSON. Plus `answer_cache_get/set` (full-answer cache) and `share_get/set` (7-day TTL share permalinks).
  - `src/agent/observability.py` — OTel tracer + Prometheus instruments, hardened against pytest tear-down and busy ports.
- **Frontend** (2 552 LOC TS/TSX, 9 components):
  - `web-agent/src/hooks/useStream.ts` — single hook owning: messages, per-session storage with legacy-key migration, controls (`proof-controls`), session list (new/switch/rename/delete), and the SSE event handlers (`stage`/`queries`/`token`/`coverage`/`followups`/`done`/`error`).
  - `web-agent/src/components/Message.tsx` — inline markdown + footnote citations + source favicons (hover → snippet), coverage bar, "show the work" panel (queries + optional Jaeger trace link), follow-up chips, Share / Listen / Copy+Sources / Regenerate actions.
  - `web-agent/src/components/{Chat,Header,ChatInput,Settings,Sidebar,SharedView,Pipeline}.tsx` — composer, masthead, gear popover (length/sources/format/recency), Archive drawer, read-only published proof at `/share/<id>`, live press-run.
  - Design system in `web-agent/src/index.css` — CSS variables for the riso palette (cobalt × flame on newsprint), film grain (`feTurbulence` SVG), halftone dots, overprint, misregistered titles, hard-offset shadows, print stylesheet via `@media print` + `.no-print`.
- **Providers / external services**:
  - OpenAI `gpt-3.5-turbo` via LangChain `ChatOpenAI` when `OPENAI_API_KEY` is set; offline stub otherwise.
  - Serper (Google SERP) with optional Bing; both fall back to deterministic mock pool when keys/retries fail.
  - Upstash Redis (`rediss://…upstash.io:6379`) for answer cache + share permalinks; transparently degrades to no-op without `REDIS_URL`.
  - OpenTelemetry Collector → Jaeger (local, via Docker Compose) for trace UI.
- **Deployment topology (live)**: Vercel auto-deploys the SPA from the `production` branch (root dir `web-agent/`, `VITE_API_BASE_URL` injected via `vercel.json`) → custom domain `proof.abhira.dev` (GoDaddy CNAME → `cname.vercel-dns.com`). Backend runs on a **Docker SDK Hugging Face Space** (`AbhiRaa/proof`) updated via `huggingface_hub.HfApi.upload_folder`; secrets set via `HfApi.add_space_secret`. Same multi-stage Dockerfile would run unchanged on Fly/Cloud Run/Render/Railway.

## 3) Measurable Metrics
### A) Git stats
- Total commits: **78** (`git rev-list --count HEAD`).
- Commits by Abhinav: **78** (`git rev-list --count --author='AbhiRaa\|Abhinav' HEAD`).
- First commit: **2025-07-10**; latest commit: **2026-05-28** — ~10 months active.
- Active months: **2**, active weeks: **4** (unique `%Y-%m` / `%Y-%V` from `git log`).

### B) API metrics
- FastAPI endpoints: **7** (5 GET, 1 POST, 1 WebSocket) — `src/agent/server.py`.
- Streaming: **1 SSE** (`/api/stream`) + **1 WebSocket** (`/api/ws`); both emit `stage`/`queries`/`token`/`coverage`/`followups`/`done`/`error` events from the same `astream_answer` generator.
- Read endpoints: `/health`, `/api/usage` (auth + rate-limit visibility), `/api/share/{id}` (read a published proof), `/debug` (gated behind `AGENT_DEBUG=1`).
- Write endpoints: `POST /api/share` (publish an answer payload for a `/share/<id>` permalink).

### C) Agent metrics
- LangGraph nodes: **4** registered (`generate`, `search`, `reflect`, `synthesize`) + manual orchestration in `astream_answer` for streaming.
- Prompt templates: **4** ChatPromptTemplate definitions (Generate / Reflect / Synthesize / Follow-ups).
- Tools: **1** `web_search` tool with Bing/Serper providers, recency filter (`day`/`week`/`month`), deterministic mock fallback.
- Resilience: **8 s** per-request timeout, **2** retries with incremental 0.2 s back-off on 429/timeout, broad exception catch-all → mock fallback. Search-result field access hardened with `.get()` + URL-required filter.
- Caching: **2 layers** — search cache (`@cached(ttl=3600)`) and full-answer cache (`answer_cache_*`, keyed on `question::w<words>::s<sources>::r<recency>::f<fmt>` so different control sets don't poison each other).
- User controls (per request): **4 axes** — `max_words` (Brief 40 / Standard 80 / Detailed 150, hard-enforced via `trim_words`), `max_sources` (1–5), `recency` (any/day/week/month → Serper `tbs=qdr:*`), `fmt` (prose / bullets / TL;DR).
- Citation integrity: post-stream `_normalize_citations` dedupes by URL, renumbers `[n]` in answer order, drops orphan markers — guarantees real sources only.
- Follow-ups: 2 LLM-generated next questions per answer (gpt-3.5 with hardened JSON parsing).

### D) Observability metrics
- Prometheus: `agent_requests_total` (counter, per-phase) and `agent_phase_latency_seconds` (histogram, per-phase); HTTP server on `PROM_PORT` (default 8000; 9100 in HF deploy to avoid uvicorn collision).
- OpenTelemetry: per-node spans (`generate` / `search` / `reflect` / `synthesize`) + a **root request span** so a single `trace_id` flows back to the UI in the `done` event.
- Trace UI: Docker Compose ships `jaeger` (all-in-one) alongside the collector; the SPA renders a "view trace ↗" link per answer when `VITE_JAEGER_URL` is set.

### E) Frontend metrics
- Components: **9 first-party** (Chat, Header, ChatInput, Settings, Sidebar, SharedView, Pipeline, Message, App) on top of a small shadcn UI set.
- Routes: SPA with a pathname-match short-circuit to `SharedView` at `/share/<id>` (no router dep).
- Streaming client: native `EventSource` consuming 7 distinct event types; handles drops/errors/stop and exposes `regenerate`/`stopStream`.
- Persistence: per-session `localStorage` keys (`proof-sessions`, `proof-active-session`, `proof-msgs-<id>`, `proof-controls`, `proof-theme`) with a one-shot migration from the legacy `proof-conversation` key.
- A11y: live regions on the streaming answer, `aria-pressed`/`role=radio` on the segmented theme toggle, `aria-expanded` on the settings popover, keyboard paths through citation footnotes, `prefers-reduced-motion` honoured by all keyframes, focus-visible riso rings.
- Voice: composer mic via `SpeechRecognition`; per-answer "Listen" via `speechSynthesis`. Both feature-detected — hidden cleanly on Firefox / unsupported browsers.

### F) Quality / Ops
- Tests: **6** deterministic pytest scenarios (`tests/test_{happy,no_result,http429,timeout,two_round,slot_reflect}.py`) — all keyless/offline; the previously-flaky `test_cli_stub` was fixed by setting API keys to `""` (so `load_dotenv` can't refill them).
- CI: `.github/workflows/ci.yml` — `pytest` on Python 3.11 + frontend `npm ci`+`npm run lint`+`npm run build` on Node 20, triggered on push/PR.
- E2E: Playwright config in `web-agent/playwright.config.ts`, smoke specs in `web-agent/e2e/` (`npm run e2e:install` once, then `npm run e2e`).
- Docker: 1 **multi-stage** `Dockerfile` (node 20 builds the SPA, python 3.11 mounts it via `_SPAFiles` SPA-fallback StaticFiles); 1 `docker-compose.yaml` with `redis`, `otel-collector`, `jaeger`, `agent` services for local dev.
- Lint/format: ESLint 9 for the SPA (`web-agent/eslint.config.js`); black + isort listed in `requirements.txt` for Python.
- Production hygiene: `/debug` returns 404 unless `AGENT_DEBUG=1`; rate limit returns 429 with a friendly JSON body; share endpoint returns 503 when Redis is unreachable (instead of crashing); answer-cache key includes user controls so a 40-word answer can never be served for a 150-word request.

## 4) Evidence-Based Contributions
- Designed the four-node LangGraph pipeline + a parallel **streaming entrypoint** (`astream_answer`) that runs the same stages and emits typed events for SSE/WebSocket — replacing the prior fake 50-char chunking with **real LLM token streaming** (`src/agent/graph.py`, `src/agent/nodes.py::call_llm_stream`/`synthesize_stream`).
- Built **multi-turn memory**: frontend ships the last 4 turns as a `history` query param; `generate_node` uses it to rewrite follow-ups into standalone search queries (`src/agent/nodes.py::generate_node`, `web-agent/src/hooks/useStream.ts::buildHistory`).
- Implemented **user answer-controls** end-to-end: length / sources / recency / format flow as query params → `astream_answer` → `synthesize_stream`, with `trim_words` enforcing the budget (model compliance isn't enough), Serper `tbs=qdr:*` honouring recency, and the cache key folding all four so cache hits never mis-serve (`src/agent/graph.py`, `src/agent/nodes.py`, `web-agent/src/components/Settings.tsx`).
- Added **transparency** surfaces: the Reflect step's `slots`/`filled` is emitted as a `coverage` event ("3/4 facts sourced"), the generated search queries are emitted live, and the `done` event carries the OTel `trace_id` for an optional Jaeger link — all surfaced in the answer UI without leaking implementation details (`src/agent/graph.py`, `web-agent/src/components/Message.tsx`).
- Built **citation integrity** as a post-stream pass: `_normalize_citations` dedupes sources by URL, renumbers `[n]` markers in order of first appearance, and drops orphan markers — eliminating hallucinated citations from the user-visible answer (`src/agent/graph.py::_normalize_citations`).
- Hardened **JSON parsing** for gpt-3.5's quirks with `_extract_json` (strips ```fences, digs out the first `{}`/`[]` block) used by Reflect and follow-ups; `generate_node` was also rewritten to accept dict-with-any-list-value and to always fall back to the raw question so search never runs empty (`src/agent/nodes.py`).
- Diagnosed and fixed a **production-critical search bug**: `TIMEOUT_SECS=1.0` was sending every live query to mock fallback (>1 s Serper latency); raised to 8 s and hardened result parsing with `.get()` + URL filter so missing `snippet` fields no longer dump valid results to mock; broadened exception handling so `aiohttp.ClientError` degrades to mock instead of crashing a node (`src/agent/tools.py`).
- Shipped **shareable permalinks**: `POST /api/share` returns a short opaque id, `GET /api/share/{id}` reads it back (7-day Redis TTL with 503 fallback when Redis is down); frontend Share button copies `/share/<id>` and a `SharedView` renders the read-only proof — no router needed, App.tsx short-circuits on pathname match (`src/agent/server.py`, `src/agent/cache.py::share_get/set`, `web-agent/src/components/SharedView.tsx`).
- Added **optional Bearer/API-key auth** with separate authed/anon rate limits (env-driven; `Authorization: Bearer`, `X-API-Key`, or `?api_key=` query param all accepted) plus `GET /api/usage` for caller-side visibility (`src/agent/server.py::_client_for`).
- Implemented a **full-answer cache** keyed on `question::w<words>::s<sources>::r<recency>::f<fmt>` so repeats are instant and free, but a 40-word answer is never served for a 150-word request (`src/agent/cache.py::answer_cache_get/set`, `src/agent/graph.py::_cache_key`).
- Built a **single-deploy Docker pipeline**: multi-stage Dockerfile (node 20 builds the SPA, python 3.11 image mounts it at `/` via a custom `_SPAFiles(StaticFiles)` with SPA fallback so `/share/<id>` resolves to `index.html`) — one image, one URL, no cross-origin chrome (`Dockerfile`, `src/agent/server.py::_SPAFiles`).
- Wired **per-request OTel root span** in the server so a single `trace_id` covers the whole pipeline (`src/agent/server.py`), and added a `jaeger` service to Docker Compose with the collector exporting OTLP → Jaeger so traces are viewable at `localhost:16686` (`compose.yaml`, `otel.yaml`).
- Designed and implemented the **PROOF Risograph UI** as a complete identity: Bricolage Grotesque + Newsreader + Space Mono, cobalt × flame inks on newsprint, film grain (`feTurbulence` SVG), halftone, overprint, misregistered ghost titles, hard-offset card shadows, sliding-plate theme toggle, refined clear/print/export buttons, `@media print` stylesheet with a `.no-print` chrome opt-out (`web-agent/src/index.css`, all of `web-agent/src/components/`).
- Rewrote `useStream.ts` as a session-aware hook: per-session message persistence with legacy-key migration, control state, history threading, regenerate/stop, and the full SSE event multiplex (`web-agent/src/hooks/useStream.ts`).
- Built the **sessions sidebar** (Archive drawer) with new/switch/rename/delete and an automatic title from the first user message (`web-agent/src/components/Sidebar.tsx`).
- Added **voice features**: composer mic via Web Speech API (`SpeechRecognition`), per-answer Listen via `speechSynthesis`, both feature-detected and hidden where unsupported (`web-agent/src/components/ChatInput.tsx`, `web-agent/src/components/Message.tsx`).
- Rendered answers with a tiny **safe inline-markdown parser** (no `dangerouslySetInnerHTML`) that interleaves bold/italic/code/links with citation footnotes; sources show favicons + hover-revealed snippets (`web-agent/src/components/Message.tsx::renderRich`).
- Resolved a sneaky **Tailwind v4 ↔ v3-directives gap**: arbitrary `grid-cols-*` utilities and the preflight `<button>` reset weren't emitting, which caused (a) a flat-grey TOC bug in dark mode (buttons fell through to OS `ButtonFace`) and (b) a stacked-column starter grid; fixed via explicit form reset in the base layer + inline `repeat(auto-fit, minmax(280px, 1fr))` grid (`web-agent/src/index.css`, `web-agent/src/components/Chat.tsx`).
- Fixed the previously-flaky `test_cli_stub`: instead of `pop()`ing keys (which `load_dotenv` cheerfully refilled from `.env`), the test now **sets keys to `""`** in the child env so the agent is genuinely offline — restoring 7/7 deterministic test runs (`tests/test_happy.py`).
- Added a **GitHub Actions CI workflow** (`pytest` on Python 3.11 + `npm ci`/`lint`/`build` on Node 20) and a **Playwright** smoke E2E with a Vite preview webServer (`.github/workflows/ci.yml`, `web-agent/playwright.config.ts`, `web-agent/e2e/empty.spec.ts`).
- Deployed live, **end-to-end on free tier**: Vercel SPA on `proof.abhira.dev` (GoDaddy CNAME) calling the FastAPI agent on **Hugging Face Spaces** (Docker SDK; published via `huggingface_hub.HfApi.upload_folder`, secrets via `add_space_secret`) backed by **Upstash Redis** for cache + share permalinks. Removed the Railway-era artifacts (`railway.json`, `test_server.py`, `DEPLOYMENT.md`) when the topology moved.

## 5) Resume-Ready Bullet Pool (15 bullets)
- Designed and shipped a 4-node LangGraph research agent (Generate → Search → Reflect ≤2 loops → Synthesize) that always answers in ≤80 words with deduplicated, validated citations and runs **fully offline** in CI via a deterministic stub LLM + mock-search fallback. Evidence: `src/agent/graph.py`, `src/agent/nodes.py`.
- Built **real-time SSE/WebSocket token streaming** with 7 typed event kinds (`stage`/`queries`/`token`/`coverage`/`followups`/`done`/`error`) — replacing fake fixed-size chunking with genuine LangChain `astream` LLM tokens. Evidence: `src/agent/server.py`, `src/agent/nodes.py::call_llm_stream`/`synthesize_stream`.
- Implemented **per-request answer controls** (length / sources / recency / format) threaded end-to-end with `trim_words` hard-enforcement and a control-aware cache key so repeats are instant but never mis-served. Evidence: `src/agent/graph.py`, `web-agent/src/components/Settings.tsx`.
- Built a **citation-integrity** post-stream pass that dedupes sources by URL, renumbers `[n]` markers in answer order, and drops orphan markers — eliminating hallucinated citations before they reach the user. Evidence: `src/agent/graph.py::_normalize_citations`.
- Diagnosed a production-critical search regression where a 1-second timeout was sending every live query to mock fallback; **raised to 8 s and hardened response parsing** with `.get()` + URL filtering, restoring real results. Evidence: `src/agent/tools.py`.
- Shipped **shareable permalinks** (`POST /api/share` → opaque id, `GET /api/share/{id}` with 7-day Redis TTL, 503 fallback when Redis is down) and a read-only `/share/<id>` SPA view rendered without adding a router dep. Evidence: `src/agent/server.py`, `web-agent/src/components/SharedView.tsx`.
- Added **optional Bearer/API-key auth** with per-key sliding-window rate limits, 30/min anon vs 120/min authed, and a `GET /api/usage` introspection endpoint. Evidence: `src/agent/server.py::_client_for`.
- Wired **per-request OpenTelemetry root span** so a single `trace_id` reaches the UI in the `done` event, and added Jaeger (Docker Compose) so traces are viewable at `localhost:16686`. Evidence: `src/agent/server.py`, `compose.yaml`, `otel.yaml`.
- Built a **session-aware streaming hook** that holds messages, controls, sessions list, and the SSE event multiplex; persists per-session messages in localStorage with a one-shot migration from the legacy single-conversation key. Evidence: `web-agent/src/hooks/useStream.ts`.
- Designed the **PROOF Risograph editorial UI** (Bricolage Grotesque + Newsreader + Space Mono, cobalt × flame on newsprint, film grain, halftone, overprint, misregistered ghost titles, sliding-plate theme toggle) — replacing a generic purple-gradient template with a distinctive, on-brand identity. Evidence: `web-agent/src/index.css`, all of `web-agent/src/components/`.
- Surfaced **transparency widgets** (coverage bar, "show the work" panel with the real search queries + optional Jaeger trace link, source favicons + hover snippets) so users can verify the agent's work, not just trust it. Evidence: `web-agent/src/components/Message.tsx`.
- Added **voice features** (composer mic via `SpeechRecognition`, per-answer "Listen" via `speechSynthesis`) — feature-detected so the buttons hide cleanly on Firefox / unsupported browsers. Evidence: `web-agent/src/components/ChatInput.tsx`, `web-agent/src/components/Message.tsx`.
- Built a **single-deploy multi-stage Dockerfile** (node 20 builds the SPA, python 3.11 mounts it via a custom `_SPAFiles(StaticFiles)` with 404→`index.html` SPA fallback) so client routes like `/share/<id>` resolve correctly in one container. Evidence: `Dockerfile`, `src/agent/server.py::_SPAFiles`.
- Stabilised a previously-flaky CI test (`test_cli_stub`) by setting API keys to `""` in the child env so `load_dotenv` couldn't refill them — restoring 7/7 deterministic, keyless test runs. Evidence: `tests/test_happy.py`.
- Deployed live on the free tier with a custom domain: **Vercel SPA** on `proof.abhira.dev` (GoDaddy CNAME) → **Hugging Face Spaces** Docker backend → **Upstash Redis**; added GitHub Actions CI (pytest + frontend lint+build) and a Playwright smoke E2E. Evidence: `vercel.json`, `Dockerfile`, `.github/workflows/ci.yml`, `web-agent/playwright.config.ts`.

## 6) Interview Justifications (STAR Notes)
- **Streaming was theatre, not real (S)** — the original server ran the entire pipeline then sliced the final answer into 50-char chunks before SSE; the "live typing" was a lie. **(T/A)** Refactored synthesize into a token-streaming async generator (`synthesize_stream` / `call_llm_stream`) using LangChain `astream`, exposed via a typed event protocol (`stage`/`queries`/`token`/`coverage`/`followups`/`done`/`error`), and surfaced real pipeline stages so the on-screen "press run" reflects what the agent is actually doing. **(R)** The first synthesize token now appears within ~700 ms of stage 4 starting, and the offline stub streams word-by-word so behaviour is identical with or without an API key. Evidence: `src/agent/nodes.py`, `src/agent/graph.py::astream_answer`, `src/agent/server.py`.
- **Hallucinated citations were a real risk (S)** — gpt-3.5 sometimes invents `[4]` even when only three sources were fetched. **(A)** Added a deterministic post-stream `_normalize_citations` pass that dedupes by URL, renumbers `[n]` markers in answer-order, and drops anything without a matching source. **(R)** Every citation in the UI is provably tied to a fetched URL; the function-calling bonus from the original spec is satisfied by structured validation rather than streaming-breaking response_format. Evidence: `src/agent/graph.py::_normalize_citations`.
- **Live search regressed silently (S)** — every query was returning mock data because `TIMEOUT_SECS=1.0` was tripping before Serper could respond, and missing `snippet` fields raised `KeyError` that dumped valid results to mock. **(A)** Raised the timeout to 8 s, switched all result-field access to `.get()` with URL-required filtering, and broadened the exception catch to include `aiohttp.ClientError`. **(R)** Live queries now reach real Serper results consistently, and the mock pool is reserved for genuinely keyless/offline runs as designed. Evidence: `src/agent/tools.py`.
- **The free tier needed a real story (S)** — Railway's free tier ended and the deployed instance was deleted. **(A)** Rearchitected for a free single-deploy: multi-stage Dockerfile builds the SPA in node and serves it from FastAPI via SPA-fallback StaticFiles; pushed the backend to a Hugging Face Docker Space (`huggingface_hub.HfApi.upload_folder` + `add_space_secret`), kept the SPA on Vercel, wired Upstash Redis for cache + share, and pointed `proof.abhira.dev` at Vercel via a GoDaddy CNAME. **(R)** End-to-end live on free tier with full streaming, share permalinks, cache, custom HTTPS domain — and the same Dockerfile would run unchanged on Fly/Cloud Run/Render. Evidence: `Dockerfile`, `vercel.json`, `src/agent/cache.py::share_get/set`.
- **Generic AI-slop UI was the wrong signal (S)** — the previous frontend was a purple-gradient clone with "Where knowledge begins" hero text. **(A)** Designed PROOF as a distinctive Risograph-editorial identity (Bricolage Grotesque + Newsreader + Space Mono, cobalt × flame on newsprint, film grain, halftone, overprint, misregistered ghost titles, hard-offset card shadows) and built the components to match — sliding-plate theme toggle, settings popover, transparency panels, follow-up chips, sessions sidebar, share, voice, print-to-PDF. **(R)** A genuinely *designed* product surface that signals craft and on-brand AI editorial trust. Evidence: `web-agent/src/index.css`, all of `web-agent/src/components/`.
- **The framework setup had silent gaps (S)** — Tailwind v4 with leftover v3 `@tailwind` directives wasn't emitting the preflight button reset (which made `<button>`s fall through to OS `ButtonFace` — a grey block in dark mode!) or arbitrary `grid-cols-*` utilities. **(A)** Probed via Chrome DevTools Protocol, traced the missing rules, added an explicit form reset in the base layer, and swapped fragile `grid-cols-N` for `repeat(auto-fit, minmax(280px, 1fr))` inline grid — which is also more responsive. **(R)** Visible UI bugs fixed without destabilising the rest of the stylesheet. Evidence: `web-agent/src/index.css`, `web-agent/src/components/Chat.tsx`.
- **Tests were flaky and not really testing what they claimed (S)** — `test_cli_stub` `pop()`ed API keys but `load_dotenv` cheerfully repopulated them from `.env`, so the "offline" test was actually hitting the live network and crashing on transient errors. **(A)** Switched to setting the keys to `""` (which `load_dotenv(override=False)` won't overwrite), and updated other test mocks to accept the new `recency` kwarg as the signature grew. **(R)** 7/7 deterministic, genuinely keyless test runs. Evidence: `tests/test_happy.py`, `tests/test_no_result.py`.
- **Observability had to be honest in prod (S)** — the original `/debug` route ran the full pipeline and dumped raw tracebacks on a public GET. **(A)** Gated it behind `AGENT_DEBUG=1` (404 otherwise), added a sliding-window per-IP rate limiter with friendly 429s, optional Bearer/API-key auth with a higher authed limit, and a `GET /api/usage` introspection endpoint. **(R)** Endpoints safe to expose publicly; abuse risk for the live demo is bounded. Evidence: `src/agent/server.py`.

## 7) Commands I Ran (Reproducibility)
- `git rev-list --count HEAD`
- `git rev-list --count --author='AbhiRaa\|Abhinav' HEAD`
- `git shortlog -sn --all`
- `git log --reverse --format=%cs | head -1`
- `git log -1 --format=%cs`
- `git log --format='%cd' --date=format:'%Y-%m' | sort -u | wc -l`
- `git log --format='%cd' --date=format:'%Y-%V' | sort -u | wc -l`
- `grep -E '@app\.(get|post|websocket|delete|put|patch)\b' src/agent/server.py | wc -l`
- `ls tests/test_*.py | wc -l`
- `find src -name '*.py' | xargs wc -l | tail -1`
- `find web-agent/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | tail -1`
- Live SSE smoke-test: `curl -sN "https://AbhiRaa-proof.hf.space/api/stream?question=…&max_words=40&fmt=bullets"`
- Live share roundtrip: `curl -X POST .../api/share -d '…'` then `curl .../api/share/<id>`
- Local stack: `docker compose up -d redis otel-collector jaeger` (Jaeger UI at <http://localhost:16686>), then `PYTHONPATH=src uvicorn agent.server:app --port 8001` and `cd web-agent && npm run dev`.
