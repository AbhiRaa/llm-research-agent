#!/bin/bash
# Container entrypoint. Honours $PORT (HF Spaces, Fly, Cloud Run, Render,
# Railway, etc. all inject it). Falls back to 8000 for local docker run.

export PORT=${PORT:-8000}
exec uvicorn agent.server:app --host=0.0.0.0 --port=$PORT --proxy-headers