# ---------- Base ----------
FROM python:3.11-slim

# ---------- System set-up ----------
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# ---------- Dependencies ----------
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------- Source code ----------
COPY src ./src
COPY README.md .

ENV PYTHONPATH=/app/src

# ---------- Entrypoint ----------
# Use CMD instead of ENTRYPOINT so Railway can override the command
CMD ["python", "-m", "agent.cli"]
