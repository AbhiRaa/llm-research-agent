"""
Public API: answer_sync, answer_question, nodes sub-module.
Initialises tracing/metrics on first import.
"""
from .observability import init as _init_obs

_init_obs()  # side-effect: start tracing + Prom server

from .graph import answer_sync, answer_question  # noqa: E402  (after side-effects)

__all__ = ["answer_sync", "answer_question"]
