"""
Pytest configuration: ensure `src/` is on sys.path
so `import agent` works without needing PYTHONPATH env vars.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src"
sys.path.insert(0, str(SRC_DIR))
