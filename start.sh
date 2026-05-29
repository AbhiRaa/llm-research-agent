#!/bin/bash
# Container entrypoint. Honours $PORT (HF Spaces, Fly, Cloud Run, Render,
# Railway, etc. all inject it). Falls back to 8001 for local docker run — the
# documented API port (Prometheus uses 8000, so don't default uvicorn there or
# they collide).

export PORT=${PORT:-8001}
exec uvicorn agent.server:app --host=0.0.0.0 --port=$PORT --proxy-headers