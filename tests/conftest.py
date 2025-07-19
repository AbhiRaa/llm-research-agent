"""
Pytest bootstrap.

* Prepends the project’s *src/* directory to ``sys.path`` so that a plain
  ``import agent`` works even when the user hasn’t set PYTHONPATH.
* No fixtures are defined here – it is purely path‑setup.
"""

import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src"
sys.path.insert(0, str(SRC_DIR))
