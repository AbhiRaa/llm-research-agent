# Teamwork AI – LLM Research Agent (v1)

🚀 **[Live Demo → proof.abhira.dev](https://proof.abhira.dev)** 🚀

> SPA hosted on **Vercel** · agent backend on **Hugging Face Spaces** ([source](https://huggingface.co/spaces/AbhiRaa/proof)) · cache + share via **Upstash Redis** — all on free tiers.

A production‑style research assistant that answers any question in ≤ 80 words and **always** cites its sources.  
Runs end‑to‑end **offline** for CI, upgrades to real web‑search + GPT‑4o‑mini when you export the relevant API keys (override with `OPENAI_MODEL`).

> **Pipeline** – Generate → Search → Reflect (≤ 2 loops) → Synthesize  
> **Stack** – Python 3.11 · Docker · LangGraph · OpenAI API · FastAPI · Redis (cache) · OpenTelemetry · Prometheus · Jaeger · Serper/Bing

> **v3 highlights** — real token streaming over SSE/WS · live pipeline-stage events · multi-turn memory · markdown answers with footnote citations + favicons · full-answer cache · per-IP rate limiting · gated `/debug` · Jaeger traces · the **PROOF** Risograph UI.

> **v4 hardening** — `javascript:`/`data:` href scheme guard on every rendered link (client + server) · size/type/field caps on `POST /api/share` (no Redis junk-fill) · question-length cap on the stream endpoints · proxy-aware rate limiting (`X-Forwarded-For` when `TRUST_PROXY`) with stale-bucket eviction · spec-compliant CORS · rate-limited `/debug` · graceful cold-start “waking up” UI for the sleeping free-tier backend · mobile bottom-sheet settings.

---

## 1 – Architecture at a Glance

                                                +-----------------------------+
                                                |   CLI / HTTP / WS question  |
                                                +--------------+--------------+
                                                            |
                                                            v
                +------------------+           +-----------------------------+
                |  Generate        |           |  Web Search (Bing / Serper) |
                |  queries         |           +---------------+-------------+
                +--------+---------+                           |   (1 h LRU)
                            |                                     |  cache layer
                            |                                     v
                            |                        +------------+------------+
                            |                        |        Redis            |
                            |                        +------------+------------+
                            |                                     ^
                            |                                     |
                            v                                     |
                +--------+---------+                           |
                |  Reflect (slot‑   |<--------------------------+
                |  aware checker)   |
                +--------+---------+
                            |
                            | need_more?  yes ──► (loops back to Web Search)
                            | 
                            | no
                            v
                +--------+---------+
                |   Synthesize     |  (≤ 80 words + space‑separated [n] cites)
                +--------+---------+
                            |
                            v
                +--------+---------+
                |   JSON answer    |
                +------------------+

   Telemetry: every boxed phase ↑ sends spans to **OpenTelemetry**  
              and latency counters / histograms to **Prometheus**.

---

## 2 – Local Dev

### 2.1 Plain Python

# ➊ clone & install
    git clone https://github.com/AbhiRaa/llm-research-agent.git
    cd llm‑research‑agent && python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt

# ➋ stub‑mode (works offline)
    PYTHONPATH=src python -m agent.cli "Who won the 2022 FIFA World Cup?"

### 2.2 Docker

# Build the image (once)
    docker compose build agent

# Bring up supporting services (redis + otel‑collector)
    docker compose up -d redis otel-collector agent

# Run the agent image interactively
        docker compose run --rm agent python -m agent.cli "Explain vector databases in 3 sentences"

---

## 3 – HTTP Streaming End‑points

| Type          | URL                          | Quick test                                                                |
| ------------- | ---------------------------- | ------------------------------------------------------------------------- |
| **SSE**       | `GET /api/stream?question=…` | `curl -N "http://localhost:8001/api/stream?question=Who+invented+Docker"` |
| **WebSocket** | `ws://…/api/ws?question=…`   | `npx wscat -c "ws://localhost:8001/api/ws?question=What+is+RAG"`          |

**Real token streaming.** Both endpoints stream the agent's progress as discrete events (SSE `event:` frames / raw JSON over WS): `stage` (live pipeline phase, with doc counts), `token` (a synthesize token as the model emits it), `done` (`{answer, citations, cached}`), and `error` (graceful, user-safe). Both accept an optional `&history=...` param (recent turns) for **multi-turn follow-ups**. Repeat questions are served from a **full-answer cache** (`cached:true`); a proxy-aware **rate limit** (`RATE_LIMIT_PER_MIN`, default 30; keyed on `X-Forwarded-For` when `TRUST_PROXY=1`, with stale buckets evicted) returns HTTP 429 when exceeded, and the `question` is length-capped (`MAX_QUESTION_CHARS`, default 2000); `/debug` is itself rate-limited and disabled unless `AGENT_DEBUG=1`.

**Answer controls.** A composer settings popover lets the reader tune each run, sent as query params and honoured end-to-end (and folded into the cache key):
`max_words` (Brief 40 / Standard 80 / Detailed 150, hard-enforced) · `max_sources` (1–5, fetched + cited) · `fmt` (prose / bullets / tldr) · `recency` (any / day / week / month → Serper `tbs=qdr:*`).

**Transparency.** Each answer surfaces a **coverage** bar (which required facts the evidence covered, from the Reflect step), a **show-the-work** panel listing the real search queries (and a Jaeger trace link when `VITE_JAEGER_URL` is set), source **favicons + hover snippets**, and 2 suggested **follow-up** questions. A **Print proof** action renders the conversation as a clean editorial PDF.

**Trust & ergonomics.** Each answer's `[n]` markers are validated against real source URLs and renumbered (orphan markers dropped, sources deduped). **Optional Bearer/API-key auth** (`API_KEYS` env, header `Authorization: Bearer …` or `?api_key=…` query param) bumps the rate limit from 30/min to 120/min and shows up on `GET /api/usage`. **Shareable permalinks** via `POST /api/share` (returns an opaque id) + `GET /api/share/{id}`; the payload is size/type/field-capped and URL-scheme-validated server-side (`MAX_SHARE_BYTES`, default 64 KB) so it can't be abused to junk-fill Redis; the frontend renders read-only proofs at `/share/<id>`. The **Archive sidebar** holds multiple sessions in localStorage with rename/delete. Composer **mic** (Web Speech API) and per-answer **Listen** button (`speechSynthesis`) appear where supported.

**Single-deploy.** The Dockerfile is multi-stage: a node stage builds the SPA and the python stage mounts it at `/` via `StaticFiles` with an SPA fallback, so one container serves both the API and the UI from one URL.

**CI + E2E.** GitHub Actions (`.github/workflows/ci.yml`) runs `pytest` and the frontend lint+build on every push. A Playwright smoke E2E lives in `web-agent/e2e/` — install once with `npm run e2e:install`, then `npm run e2e`.

---

## 4 – Redis Cache Cheat‑sheet

### 4.1 Connect to Redis running via docker‑compose

    # open an interactive redis‑cli in the same network
    docker exec -it agent-redis-1 redis-cli

### 4.2 List cached queries

    KEYS web_search:*            # show all cached search keys
    GET  web_search:('query',)   # inspect one entry
    TTL  web_search:('query',)   # seconds remaining (≈3600)

### 4.3 Flush everything (⚠️ clears all data)

    FLUSHALL

(You can also run docker compose exec redis redis-cli FLUSHALL  from the shell.)

---

## 5 - Running the chat UI (web‑agent/)

The repository includes a very small Vite + React front‑end that talks to the agent’s streaming API.
Directory layout (top‑level):

    llm-research-agent/
    ├─ src/          ← all Python back‑end code
    ├─ web-agent/    ← the React / Vite front‑end
    └─ docker‑compose.yml

### 5.1 - Local dev (hot‑reload)

    # install JS deps
    cd web-agent
    npm install         # or: pnpm install / yarn

    # start the dev server
    npm run dev

Open http://localhost:5173 – you’ll see a single‑column chat window.
Ask a question; the UI connects to ws://localhost:8001/api/ws and streams tokens as they arrive.

## 6 - Testing Matrix

| What                         | Command                                                                   | Notes                                                             |                                 |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Unit / integration tests** | `pytest -q`                                                               | 8 deterministic cases (timeout, 429 retry, two‑round loop, etc.). |                                 |
| **Manual CLI**               | `python -m agent.cli "…" `                                                | Prints pretty JSON.                                               |                                 |
| **HTTP Streaming**           | `curl -N "http://localhost:8001/api/stream?question=Who+invented+Docker"` | Server‑sent events (`token` & `done`).                            |                                 |
| **WebSocket**                | `npx wscat -c "ws://localhost:8001/api/ws?question=What+is+RAG?"`         | Same payloads over WS.                                            |                                 |
| **Prometheus**               | \`curl [http://localhost:8000/metrics](http://localhost:8000/metrics)     | head\`                                                            | Histogram & counters per phase. |
| **Traces (local)**           | `docker compose up -d otel‑collector jaeger` then hit CLI                 | View trace at `http://localhost:16686` (Jaeger UI).               |                                 |

---

## 7 - Design Highlights

| Concern                    | Decision                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Deterministic CI**       | Stub LLM & mock search guarantee tests run without internet or keys.                                                   |
| **Retry & latency budget** | 8 s timeout wrapper + exponential back‑off (2 retries) around search; LLM calls inherited from LangChain.              |
| **Caching**                | JSON‑serialisable wrapper stores LangChain `Document`s in Redis (`agent.cache`).                                       |
| **Observability**          | OTel spans for each LangGraph node; Prom counters + histograms; both safe in pytest/CI.                                |
| **Extensibility**          | Graph edges & routing are data‑driven → easy to insert Embedding/RAG or multiple Reflect passes.                       |
| **Failure modes**          | Any exception inside a node → span `status=ERROR` but pipeline continues with stub/defaults, so the CLI never crashes. |

---

## 8 - Extension Ideas (road‑map)

| Idea                                          | Effort | Notes                                                                                 |                   |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------- | ----------------- |
| **Structured function calling in Synthesize** | ●●○    | Enforce JSON schema & real URLs (partly prototyped).                                  |                   |
| **Vector‑store RAG**                          | ●●○    | Index cached search docs; Reflect can query embeddings instead of extra Google calls. |                   |
| **Tool selection (HNSW, wiki, arXiv)**        | ●●●    | Add more search “tools” & use an LLM‑router to pick.                                  |                   |
| **Auth & billing**                            | ●●○    | Rate‑limit per API‑key, record token usage, integrate Stripe.                         |                   |
| **Fine‑grained metrics**                      | ●○○    | Attach `model.name`, `cache.hit`, \`provider="bing                                    | serper"\` labels. |

---

## 9 - Troubleshooting / FAQ

| Symptom                                                  | Fix                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **“HTTP 429 from Bing”**                                 | The retry logic should back‑off automatically; if it persists, unset `BING_API_KEY` so Serper/mock takes over. |
| **Spans but no Jaeger UI traces**                        | Ensure `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318` and that the collector container is reachable. |
| **Prometheus port already in use when running `pytest`** | Tests spawn multiple agents; `observability.py` silently skips starting a duplicate server (safe to ignore).   |
| **CLI hangs for >8 s in *search***                       | Likely internet outage; timeout triggers mock fallback after 8 s.                                              |

---

## 10 - Directory Layout

    src/agent/
        ├─ cache.py           # Redis serialization wrapper
        ├─ cli.py             # CLI entry‑point
        ├─ graph.py           # LangGraph builder
        ├─ nodes.py           # Generate / Search / Reflect / Synthesize
        ├─ tools.py           # Bing / Serper + mock
        ├─ observability.py   # OTel + Prom bootstrap
        └─ server.py          # FastAPI SSE / WebSocket
    tests/                   # 8 verified scenarios
    docker-compose.yml       # agent + redis + otel‑collector
    README.md                # you are here

---

## 11 - Bonus‑item implementation status

| Bonus feature                                            | Implemented?              | Notes                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📡 **SSE / WebSocket streaming**                         | ✅ Done                    | `src/agent/server.py` exposes `/api/stream` (SSE) and `/api/ws` (WS) that stream **real** LLM `token` events plus live `stage` (pipeline phase), `done` and `error` events. Multi-turn `history`, full-answer cache, and per-IP rate limiting included.                                                     |
| ♻️ **Redis LRU cache for query results**                 | ✅ Done                    | `@cached` decorator in `src/agent/cache.py` stores JSON‑serialisable results with a TTL (default 1 h). Becomes a no‑op when `REDIS_URL` is unset or Redis is unreachable.   |
| 📈 **OpenTelemetry traces + Prometheus metrics**         | ✅ Done                    | `src/agent/observability.py` initialises tracing (console + optional OTLP exporter) and two Prometheus instruments (`agent_requests_total`, `agent_phase_latency_seconds`). |
| 💬 **Minimal React/Vite front‑end**                      | ✅ Done                    | `web/` (or `ui/`) `web-agent/` serves **PROOF**, a Risograph/editorial chat UI (real-time token streaming, markdown answers, source favicons, conversation persistence, regenerate, export, theme toggle). Start with `npm run dev`.                                                           |
| 📑 **OpenAI function‑calling to constrain *Synthesize*** | ❌ **Not implemented yet** | Current synthesize node uses plain chat completion; adding a strict function‑call wrapper is still on the backlog.                                                          |
| 🔗 **Slot‑Aware Reflect loop**                           | ✅ Done                    | `reflect_node` emits `need_more` + `new_queries`; router loops back to *Search* until all required slots are filled or `MAX_ITER` reached.                                  |





