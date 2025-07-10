import json, subprocess, sys, os, pathlib

from agent import answer_sync

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"


def test_answer_sync():
    out = answer_sync("What is 2+2?")
    assert "answer" in out and "citations" in out


def test_cli_stub():
    # Run "python -m agent.cli  <question>"
    env = os.environ.copy()
    env["PYTHONPATH"] = f"{SRC}:{env.get('PYTHONPATH','')}"
    result = subprocess.run(
        [sys.executable, "-m", "agent.cli", "Who won the 2022 FIFA World Cup?"],
        capture_output=True,
        text=True,
        env=env,
        check=True,
    )
    data = json.loads(result.stdout)
    assert data["citations"][0]["id"] == 1
