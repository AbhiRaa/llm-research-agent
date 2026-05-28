# syntax=docker/dockerfile:1.7

# ─────────────────────── 1) build the frontend ────────────────────────────
FROM node:20-slim AS web

WORKDIR /web
COPY web-agent/package.json web-agent/package-lock.json ./
RUN npm ci

COPY web-agent/ ./
# In single-deploy, the SPA is served from the same origin as the API, so
# we drop the env files that hard-code a separate API URL and build with a
# relative VITE_API_BASE_URL ("").
RUN rm -f .env.production .env.local
RUN npm run build


# ─────────────────────── 2) python agent + frontend ──────────────────────
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY README.md .
COPY start.sh .
RUN chmod +x start.sh

# Frontend assets baked into the image; FastAPI mounts /app/web at /.
COPY --from=web /web/dist /app/web

ENV PYTHONPATH=/app/src \
    WEB_DIST_DIR=/app/web

# Most platforms (HF Spaces, Fly, Cloud Run, Render, Railway, …) inject
# the listen port via $PORT — start.sh honors it.
CMD ["./start.sh"]
