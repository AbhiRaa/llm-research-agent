import json, subprocess, sys, os
from agent import answer_sync


def test_answer_sync():
    out = answer_sync("What is 2+2?")
    assert "answer" in out and "citations" in out


def test_cli_stub(tmp_path):
    # Run the CLI script via subprocess to capture stdout
    script = os.path.join(os.path.dirname(__file__), "..", "src", "agent", "cli.py")
    result = subprocess.run(
        [sys.executable, script, "Who won the 2022 FIFA World Cup?"],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    assert "answer" in data and data["citations"][0]["id"] == 1
