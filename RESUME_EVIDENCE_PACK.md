# Resume Evidence Pack

## 1) Project Overview (5–10 lines)
- Production-style research assistant delivering ≤80-word answers with mandatory numeric citations and offline stubs when API keys are absent (`README.md:5-10`).
- LangGraph pipeline runs Generate → Search → Reflect (≤2 loops) → Synthesize stages to assemble cited responses (`README.md:8-10`; `src/agent/graph.py:19-46`).
- Serves CLI plus HTTP streaming via SSE/WebSocket for interactive use (`README.md:80-85`; `src/agent/server.py:17-112`).
- Target users are developers needing quickly verifiable research summaries with streaming chat UX and citations view (`web-agent/src/components/Message.tsx:28-207`).
- Deploys through Docker Compose (agent, Redis, OTel collector) and supports hosted backends on Railway with a Vercel frontend (`compose.yaml:1-48`; `DEPLOYMENT.md:3-40`).

## 2) Architecture & Components
- Components: 1 FastAPI backend, 1 React/Vite frontend, 1 Redis cache, 1 OpenTelemetry collector; 3 docker-compose services wired together with healthchecks and ports (`compose.yaml:1-48`; `web-agent/src/main.tsx:1-9`).
- Pipeline stages defined as four LangGraph nodes (generate/search/reflect/synthesize) with conditional routing that caps the Reflect loop at two iterations (`src/agent/graph.py:19-46`; `src/agent/nodes.py:59-198`).
- Providers: OpenAI ChatOpenAI when `OPENAI_API_KEY` exists; Bing and Serper search with deterministic mock fallback when keys or retries fail (`src/agent/nodes.py:34-57`; `src/agent/tools.py:15-144`).
- Streaming API: SSE endpoint `/api/stream` and WebSocket `/api/ws` reuse the same generator to emit token and done events (`src/agent/server.py:40-112`).
- Caching layer: Redis-backed decorator serialises LangChain `Document`s, keyed by function args with optional TTL; web_search uses a 1-hour TTL (`src/agent/cache.py:18-132`; `src/agent/tools.py:120-144`).
- Observability: Prometheus counters/histograms per phase and OpenTelemetry spans with optional OTLP exporter to a collector (`src/agent/observability.py:49-136`).

## 3) Measurable Metrics
### A) Git stats
- Total commits: 73 (git rev-list --count HEAD).
- Commits by Abhinav: 5 (git rev-list --count --author=Abhinav HEAD).
- First commit date: 2025-07-10; last commit date: 2025-07-21 (git log dates).
- Active weeks: 3; active months: 1 (unique %Y-%V and %Y-%m from git log).

### B) API metrics
- FastAPI endpoints: 4 GET routes (`src/agent/server.py:17-112`).
- Streaming endpoints: 1 SSE (`/api/stream`) and 1 WebSocket (`/api/ws`) (`src/agent/server.py:76-112`).

### C) Agent metrics
- LangGraph nodes: 4 registered nodes with conditional edge after Reflect (`src/agent/graph.py:19-46`).
- Tools: 1 web_search tool with Bing/Serper providers and deterministic mock fallback (`src/agent/tools.py:15-144`).
- Prompt templates: 3 ChatPromptTemplate definitions for Generate, Reflect, and Synthesize (`src/agent/nodes.py:65-188`).
- Caching: Redis decorator with key `func:args:sorted_kwargs`, TTL default 300s; web_search decorated at TTL 3600s (`src/agent/cache.py:101-132`; `src/agent/tools.py:120-144`).
- Retries/backoff: search calls wrap providers with 1s timeout and up to 2 retries using incremental 0.2s backoff before mock fallback (`src/agent/tools.py:120-144`).

### D) Observability metrics
- Prometheus: exports `agent_requests_total` counter and `agent_phase_latency_seconds` histogram; /metrics served via `start_http_server` on port `PROM_PORT` (default 8000) (`src/agent/observability.py:49-136`).
- OpenTelemetry: spans per node via `start_as_current_span` plus optional OTLP HTTP exporter when endpoint resolves (`src/agent/nodes.py:59-172`; `src/agent/observability.py:75-114`).

### E) Frontend metrics
- Routes/pages: single-page app bootstrapped in `main.tsx` with no router (`web-agent/src/main.tsx:1-9`).
- Key UI: Chat surface with hero prompts, streaming transcript, and sources list (`web-agent/src/components/Chat.tsx:1-188`; `web-agent/src/components/Message.tsx:28-207`).
- Streaming client: EventSource to `/api/stream` buffering token/done events with error handling (`web-agent/src/hooks/useStream.ts:18-112`).

### F) Quality/Ops
- Tests: 6 pytest files (`tests/test_happy.py`, `tests/test_http429.py`, `tests/test_no_result.py`, `tests/test_slot_reflect.py`, `tests/test_timeout.py`, `tests/test_two_round.py`).
- CI workflows: Not found.
- Docker artifacts: 1 `Dockerfile` and docker-compose with 3 services (`Dockerfile:1-28`; `compose.yaml:1-48`).
- Lint/format configs: React ESLint config present (`web-agent/eslint.config.js:1-23`); no repo-wide formatter noted.

## 4) Evidence-Based Contributions
- Built the four-node LangGraph pipeline with entry, static, and conditional edges to implement Generate → Search → Reflect → Synthesize orchestration (`src/agent/graph.py:19-46`).
- Authored slot-aware Reflect, search merging, and synthesis prompts with tracer spans and Prometheus timing across all phases (`src/agent/nodes.py:59-198`; `src/agent/observability.py:49-136`).
- Added Redis caching decorator that serialises LangChain documents and keying scheme; applied 1-hour TTL to web_search (`src/agent/cache.py:18-132`; `src/agent/tools.py:120-144`).
- Implemented Bing/Serper web_search with 1s timeout, 2 retries, and deterministic mock fallback to keep tests and offline mode stable (`src/agent/tools.py:15-144`).
- Containerised stack and streaming API exposure by wiring agent, Redis, and OTEL collector services with healthcheck and ports (`compose.yaml:1-48`).
- Delivered FastAPI SSE and WebSocket streaming endpoints plus root/health/debug routes and CORS middleware (`src/agent/server.py:7-112`).
- Instrumented Prometheus counters/histograms and guarded OTLP exporter to avoid crashes when collectors are absent (`src/agent/observability.py:49-136`).
- Shipped React/Vite chat UI with hero prompts and theme toggle wrapping streaming chat component (`web-agent/src/App.tsx:7-34`; `web-agent/src/components/Chat.tsx:1-188`).
- Created EventSource-based streaming hook and citation-aware message renderer with copy/share controls for assistant replies (`web-agent/src/hooks/useStream.ts:18-112`; `web-agent/src/components/Message.tsx:28-207`).
- Strengthened regression coverage for Reflect loop behavior via pytest (`tests/test_slot_reflect.py:1-38`).

## 5) Resume-Ready Bullet Pool (12–20 bullets)
- Built a 4-node LangGraph pipeline with Generate→Search→Reflect (≤2 loops)→Synthesize stages to deliver cited answers deterministically. Evidence: `src/agent/graph.py:19-46`; `src/agent/nodes.py:59-198`.
- Crafted slot-aware Reflect prompt that halts after two iterations and preserves state on JSON parse failures for resilience. Evidence: `src/agent/nodes.py:117-164`.
- Implemented synthesis step that guarantees citations even when no docs are returned, keeping CLI/tests stable. Evidence: `src/agent/nodes.py:173-198`.
- Engineered web search tool hitting Bing or Serper with 1s timeouts, up to 2 retries, and deterministic mock fallback. Evidence: `src/agent/tools.py:15-144`.
- Added Redis cache decorator with arg-derived keys and applied a 3600s TTL to web_search to avoid redundant calls. Evidence: `src/agent/cache.py:101-132`; `src/agent/tools.py:120-144`.
- Exposed Prometheus counter/histogram metrics and OpenTelemetry spans per pipeline phase with optional OTLP exporter. Evidence: `src/agent/observability.py:49-136`; `src/agent/nodes.py:59-172`.
- Launched FastAPI streaming API with SSE and WebSocket endpoints plus health/debug routes and CORS defaults. Evidence: `src/agent/server.py:7-112`.
- Containerised agent, Redis, and OTEL collector with published ports 8000/8001 and curl-based healthcheck. Evidence: `compose.yaml:1-48`.
- Delivered React/Vite single-page chat that toggles themes and renders hero sample prompts before conversations. Evidence: `web-agent/src/App.tsx:7-34`; `web-agent/src/components/Chat.tsx:1-188`.
- Built EventSource streaming hook buffering token/done events and handling errors/cleanup for chat responses. Evidence: `web-agent/src/hooks/useStream.ts:18-112`.
- Rendered citation-aware assistant messages with clickable sources and copy-to-clipboard controls. Evidence: `web-agent/src/components/Message.tsx:28-207`.
- Documented live demo, offline stubs, and streaming endpoints to accelerate onboarding. Evidence: `README.md:3-86`.
- Published deployment guide for Railway backend and Vercel frontend including required environment keys. Evidence: `DEPLOYMENT.md:3-40`.

## 6) Interview Justifications (STAR Notes)
- Needed deterministic answers without internet (Situation); built stubbed LLM calls and capped Reflect loop to keep outputs stable (Task/Action); ensured CLI/tests always return cited answers (Result). Evidence: `src/agent/nodes.py:24-198`.
- Faced flaky search providers (Situation); wrapped Bing/Serper with 1s timeouts, retries, and Redis cache (Action); achieved predictable responses and reuse across runs (Result). Evidence: `src/agent/tools.py:15-144`; `src/agent/cache.py:101-132`.
- Required observability without breaking tests (Situation); added Prometheus metrics and guarded OTLP exporter with resolver checks (Action); delivered spans/metrics while avoiding crashes in CI (Result). Evidence: `src/agent/observability.py:49-136`.
- Needed interactive UX for research answers (Situation); shipped SSE/WebSocket backend plus EventSource-driven React chat (Action); users receive streaming replies with inline citations (Result). Evidence: `src/agent/server.py:76-112`; `web-agent/src/hooks/useStream.ts:18-112`.
- Had to containerize supporting services (Situation); defined compose stack with agent, Redis, and OTEL collector and healthchecks (Action); enabled consistent local and Docker-based deployments (Result). Evidence: `compose.yaml:1-48`.

## 7) Commands I Ran (Reproducibility)
- `git rev-list --count HEAD`
- `git shortlog -sn --all`
- `git rev-list --count --author=Abhinav HEAD`
- `sh -c "git log --reverse --format=%cs | head -1"`
- `git log -1 --format=%cs`
- `sh -c "git log --format='%cd' --date=format:'%Y-%m' | sort -u | wc -l"`
- `sh -c "git log --format='%cd' --date=format:'%Y-%V' | sort -u | wc -l"`
- `rg -o '@(app|router)\.(get|post|put|delete|patch)\b'`
- `sh -c "ls tests/test_*.py | wc -l"`
