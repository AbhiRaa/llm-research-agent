"""
OpenTelemetry tracing + Prometheus metrics bootstrap.

Imported exactly once from agent/__init__.py so that every CLI invocation
and every test run emits spans/metrics.  The init() function is idempotent..
"""

from __future__ import annotations

import os
import sys
from typing import Optional

# ────────────────── OpenTelemetry (traces) ──────────────────
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import SpanExportResult

# ------------------------------------------------------------------ #
# Safe OTLP exporter that never propagates network errors            #
# ------------------------------------------------------------------ #

class _SafeOTLPExporter(OTLPSpanExporter):          # type: ignore[misc]
    """Wrap the official exporter and swallow connection errors so that
    unit-tests (which run without an OTLP endpoint) exit cleanly."""

    def export(self, spans):                        # type: ignore[override]
        try:
            return super().export(spans)
        except Exception:                           # any network / DNS error
            return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        try:
            super().shutdown()
        except Exception:
            pass

# ────────────────── Prometheus (metrics) ────────────────────
from prometheus_client import Counter, Histogram, start_http_server


# ───────────── Safe console exporter ─────────────
class _SafeConsoleExporter(SpanExporter):
    """Write spans to *stderr* but swallow ValueError if the stream
    is already closed (happens when pytest tears down its capture)."""

    _inner = ConsoleSpanExporter(out=sys.stderr)

    def export(self, spans):  # type: ignore[override]
        try:
            return self._inner.export(spans)
        except ValueError:
            return trace.Status(trace.StatusCode.OK)

    def shutdown(self) -> None:
        try:
            self._inner.shutdown()
        except ValueError:
            pass


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

# Module-level globals
_tracer: Optional[trace.Tracer] = None


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

    # Always register the guarded console exporter
    provider.add_span_processor(BatchSpanProcessor(_SafeConsoleExporter()))

    # If OTLP endpoint supplied, add network exporter
    otlp_ep = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if otlp_ep:
        provider.add_span_processor(
            BatchSpanProcessor(_SafeOTLPExporter(endpoint=otlp_ep))
        )

    _tracer = trace.get_tracer(__name__)

    # ──────────────── Prometheus scrape port ────────────────
    #
    # Multiple agent processes may start in quick succession during `pytest`.
    # If the port is already in use we simply skip exposing a second HTTP
    # server instead of crashing.
    #
    prometheus_port = int(os.getenv("PROM_PORT", "8000"))
    if not globals().get("_prom_started"):
        try:
            start_http_server(prometheus_port)
            globals()["_prom_started"] = True
        except OSError as e:  # Port in use — happen in pytest
            if e.errno not in (48, 98):
                raise
            print(
                f"[observability] Prometheus port {prometheus_port} busy – "
                "skipping duplicate server",
                file=sys.stderr,
            )

    return _tracer
