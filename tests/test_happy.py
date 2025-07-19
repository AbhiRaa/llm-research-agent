"""
“Happy‑path” tests that exercise the public surface:

1.  Direct synchronous helper ``answer_sync``.
2.  Full CLI invocation via ``python -m agent.cli`` (offline stub mode).

These assert only for *structure* (keys exist) – the content varies with
online/offline execution and is therefore not pinned.
"""
import json, subprocess, sys, os, pathlib

# Public helper re‑exported in agent/__init__.py
from agent import answer_sync

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

# --------------------------------------------------------------------------- #
# 1. Library call                                                             #
# --------------------------------------------------------------------------- #
def test_answer_sync():
    """The simplest smoke‑test: does the helper return a well‑formed payload?"""
    out = answer_sync("What is 2+2?")
    assert "answer" in out and "citations" in out

# --------------------------------------------------------------------------- #
# 2. CLI invocation                                                           #
# --------------------------------------------------------------------------- #
def test_cli_stub():
    """
    Spawn a *real* Python subprocess that runs the CLI entry‑point.

    We set PYTHONPATH in the child process so it can import ``agent``
    regardless of the venv / cwd of the parent test runner.
    """
    # Run "python -m agent.cli  <question>"
    env = os.environ.copy()
    env["PYTHONPATH"] = f"{SRC}:{env.get('PYTHONPATH','')}"
    result = subprocess.run(
        [sys.executable, "-m", "agent.cli", "Who won the 2022 FIFA World Cup?"],
        capture_output=True,
        text=True,
        env=env,
        check=True,     # raise if exit‑code ≠ 0
    )
    data = json.loads(result.stdout)
    # The stub always returns at least one citation whose id == 1
    assert data["citations"][0]["id"] == 1
