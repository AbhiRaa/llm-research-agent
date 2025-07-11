"""
Central place to configure OpenTelemetry tracing and Prometheus metrics.

Called once from agent/__init__.py so every CLI invocation (and tests, if
desired) automatically emits spans & metrics.

You can safely import this file anywhere; the init() function is idempotent.
"""

import os
from typing import Optional

# ────────────────── OpenTelemetry (traces) ──────────────────
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# ────────────────── Prometheus (metrics) ────────────────────
from prometheus_client import Counter, Histogram, start_http_server

# Module-level globals
_tracer: Optional[trace.Tracer] = None

# Prometheus example counters / histograms (extend as you like)
REQUEST_COUNTER = Counter(
    "agent_requests_total",
    "Total questions processed by the agent",
    ["phase"],
)
LATENCY_HISTO = Histogram(
    "agent_phase_latency_seconds",
    "Seconds spent in each pipeline phase",
    ["phase"],
    buckets=(0.01, 0.05, 0.1, 0.3, 1, 2, 5),
)


def init() -> trace.Tracer:
    """
    Initialise tracing + metrics exactly once.
    Returns a Tracer you can import and use in nodes.py / tools.py.
    """
    global _tracer
    if _tracer:  # already initialised
        return _tracer

    # ──────────────── Tracer provider ────────────────
    resource = Resource.create({"service.name": "llm-research-agent"})
    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)

    # Always log to console (handy for Docker --tty)
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    # If OTLP endpoint supplied, add network exporter
    otlp_ep = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if otlp_ep:
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_ep))
        )

    _tracer = trace.get_tracer(__name__)

    # ──────────────── Prometheus scrape port ────────────────
    prometheus_port = int(os.getenv("PROM_PORT", "8000"))
    start_http_server(prometheus_port)

    return _tracer
