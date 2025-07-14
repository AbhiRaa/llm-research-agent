Round-1 coding assignment for **Teamwork AI**.

> **Goal** – CLI agent: Generate→Search→Reflect→Synthesize → JSON answer ≤ 80 words with citations.  
> Technologies: LangChain · LangGraph · Bing Search · OpenAI GPT-3.5-Turbo.

_✏️ Detailed design, setup, and trade-offs will be filled in as we progress._

## Quick Start

### Local dev (Python ≥3.11)

python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m agent.cli "Who won the 2022 FIFA World Cup?"


### One-command Docker run

    docker compose run --rm agent "Compare Kubernetes HPA and KEDA"

If OPENAI_API_KEY / GEMINI_API_KEY / BING_API_KEY are absent, the agent falls back to deterministic mock mode so the command always works offline.


### Architecture

User Q → GenerateQueries → WebSearchTool → Reflect ⟳ (≤2) → Synthesize → JSON

- Implemented as a LangGraph 0.5 pipeline with four async nodes.
- Retry on HTTP 429, 1-second timeout wrapper, mock fallback ensures CI is deterministic.


### Tests

    pytest -q          # 6 cases: happy, no-result, 429, timeout, two-round, CLI


### 🔌 Streaming API

| Type | URL | Example |
|------|-----|---------|
| **SSE** | `GET /api/stream?question=…` |<br>`curl -N "http://localhost:8001/api/stream?question=Who+invented+Docker?"` |
| **WebSocket** | `ws://…/api/ws?question=…` |<br>`npx wscat -c "ws://localhost:8001/api/ws?question=Explain+Kubernetes+HPA"` |

The stream emits multiple `token` events followed by a final `done` payload that
contains the full answer and citations.
