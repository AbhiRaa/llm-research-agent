# Teamwork AI – LLM Research Agent (v1)

A production‑style research assistant that answers any question in ≤ 80 words and **always** cites its sources.  
Runs end‑to‑end **offline** for CI, upgrades to real web‑search + GPT‑3.5‑Turbo when you export the relevant API keys.

> **Pipeline** – Generate → Search → Reflect (≤ 2 loops) → Synthesize  
> **Stack** – Python 3.11 · Docker · LangGraph · OpenAI API · FastAPI · Redis (cache) · OpenTelemetry · Prometheus · Serper/Bing

---

## 1 – Architecture at a Glance

```mermaid
flowchart LR
    subgraph User
        Q[CLI / HTTP / WS<br/>Question]
    end
    subgraph LangGraph
        A[Generate<br/>queries]
        B[Web Search<br/>(Bing / Serper → Redis)]
        C[Reflect<br/>(slot filler)]
        D{need_more?}
        E[Synthesize<br/>≤80 w & cites]
    end
    subgraph Infra
        R[(Redis)]
        OTel[(OTel traces)]
        Prom[(Prom metrics)]
    end

    Q --> A --> B --> C --> D
    D -- yes ⟳2 --> B
    D -- no  --> E --> Q

    B <--> |1 h cache| R
    A & B & C & E --> OTel & Prom

```

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
| **Retry & latency budget** | 1 s timeout wrapper + exponential back‑off (2 retries) around search; LLM calls inherited from LangChain.              |
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
| **Frontend UI**                               | ●○○    | Minimal React / HTMX page consuming SSE for real‑time tokens.                         |                   |
| **Auth & billing**                            | ●●○    | Rate‑limit per API‑key, record token usage, integrate Stripe.                         |                   |
| **Fine‑grained metrics**                      | ●○○    | Attach `model.name`, `cache.hit`, \`provider="bing                                    | serper"\` labels. |

---

## 9 - Troubleshooting / FAQ

| Symptom                                                  | Fix                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **“HTTP 429 from Bing”**                                 | The retry logic should back‑off automatically; if it persists, unset `BING_API_KEY` so Serper/mock takes over. |
| **Spans but no Jaeger UI traces**                        | Ensure `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318` and that the collector container is reachable. |
| **Prometheus port already in use when running `pytest`** | Tests spawn multiple agents; `observability.py` silently skips starting a duplicate server (safe to ignore).   |
| **CLI hangs for >1 s in *search***                       | Likely internet outage; timeout triggers mock fallback after 1 s.                                              |

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
| 📡 **SSE / WebSocket streaming**                         | ✅ Done                    | `src/agent/server.py` exposes `/api/stream` (SSE) and `/api/ws` (WS) that stream incremental *token* and *done* events.                                                     |
| ♻️ **Redis LRU cache for query results**                 | ✅ Done                    | `@cached` decorator in `src/agent/cache.py` stores JSON‑serialisable results with a TTL (default 1 h). Becomes a no‑op when `REDIS_URL` is unset or Redis is unreachable.   |
| 📈 **OpenTelemetry traces + Prometheus metrics**         | ✅ Done                    | `src/agent/observability.py` initialises tracing (console + optional OTLP exporter) and two Prometheus instruments (`agent_requests_total`, `agent_phase_latency_seconds`). |
| 💬 **Minimal React/Vite front‑end**                      | ✅ Done                    | `web/` (or `ui/`) folder serves a Vite‑built chat UI that connects via the WS endpoint; start with `npm run dev`.                                                           |
| 📑 **OpenAI function‑calling to constrain *Synthesize*** | ❌ **Not implemented yet** | Current synthesize node uses plain chat completion; adding a strict function‑call wrapper is still on the backlog.                                                          |
| 🔗 **Slot‑Aware Reflect loop**                           | ✅ Done                    | `reflect_node` emits `need_more` + `new_queries`; router loops back to *Search* until all required slots are filled or `MAX_ITER` reached.                                  |


::contentReference[oaicite:0]{index=0}





