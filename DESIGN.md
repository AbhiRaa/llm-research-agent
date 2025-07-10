# Design Document – LLM Research Agent

**Author:** Abhinav • **Date:** $(date +%d\ %b\ %Y)

---

## 1. Goal & Scope
Deliver a *CLI-only* agent that answers arbitrary natural-language questions by orchestrating:
Generate  →  Web-Search  →  Reflect (≤2 cycles)  →  Synthesize → JSON output ≤ 80 words.

## 2. High-Level Architecture
          +----------------+
          |   CLI Driver   |
          +-------+--------+
                  |
                  v
      +-----------+------------+
      |   LangGraph Pipeline   |
      |  (state & async DAG)   |
      +---+---+---+---+---+----+
          |   |   |   |   |
          |   |   |   |   +--> 4. **Synthesize Node**
          |   |   |   +-------> 3. **Reflect Node**
          |   |   +-----------> 2. **WebSearch Node**
          |   +---------------> 1. **GenerateQueries Node**
          +-------------------> Shared Pydantic State
> **MAX_ITER = 2** loop between *Reflect* → *WebSearch*.

## 3. Module Layout
| Module | Purpose |
|--------|---------|
| `src/agent/cli.py` | Entry-point; parses CLI arg, runs graph, prints JSON. |
| `src/agent/graph.py` | Builds & compiles the LangGraph DAG. |
| `src/agent/nodes.py` | Implements four async node functions. |
| `src/agent/tools.py` | `web_search()` – Bing or mock fallback. |
| `tests/` | Five Pytest cases (happy, no-result, 429, timeout, two-round). |

## 4. Error Handling & Observability
* **HTTP 429 / timeout** → exponential backoff, retry ≤3.  
* **OpenTelemetry (bonus)** → `opentelemetry-sdk` with stdout exporter.
* 1s timeout per Bing call, 2× retry with exponential back-off.

## 5. Future Enhancements
* Slot-aware Reflect  
* Redis LRU cache  
* SSE/WebSocket streaming  
* React/Vite front-end  
* Prometheus metrics

_This document will evolve as implementation proceeds._
