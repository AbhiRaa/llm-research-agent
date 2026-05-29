#!/usr/bin/env python3
"""Deploy the current repo to the PROOF Hugging Face Space.

Used by CI (the `deploy-hf` job in .github/workflows/ci.yml) and runnable by
hand from the repo root:

    python scripts/deploy_hf.py

Auth: the ``HF_TOKEN`` env var (set as a GitHub Actions secret in CI) or a
prior ``huggingface-cli login`` (local). Override the target with ``HF_SPACE_ID``.

IMPORTANT — what is *not* uploaded:
  * ``README.md`` — the Space keeps its OWN README whose YAML frontmatter holds
    the HF config (``app_port: 7860``, ``sdk: docker``). The repo's README is the
    project readme; uploading it would clobber the Space config and break routing.
    (The Dockerfile's ``COPY README.md .`` then uses the Space's frontmatter README.)
  * docs / tests / build artifacts / local env — irrelevant to the running image.
HF only diffs changed files, so this is effectively an incremental deploy.
"""

import os

from huggingface_hub import HfApi

REPO_ID = os.environ.get("HF_SPACE_ID", "AbhiRaa/proof")

# Everything the running Docker image does NOT need, plus the two files that
# would clobber Space-managed config (README.md frontmatter, HF's .gitattributes).
IGNORE_PATTERNS = [
    ".git",
    ".git/*",
    ".gitattributes",
    ".github/*",
    "README.md",
    "CLAUDE.md",
    "RESUME_EVIDENCE_PACK.md",
    ".hf-README.md",
    "tests/*",
    "**/__pycache__/*",
    "*.pyc",
    "**/.pytest_cache/*",
    "web-agent/node_modules/*",
    "web-agent/dist/*",
    "web-agent/.env*",
    ".venv/*",
    "venv/*",
    ".DS_Store",
    "**/.DS_Store",
    "*.local",
]


def main() -> None:
    token = os.environ.get("HF_TOKEN") or None  # None → fall back to cached login
    api = HfApi(token=token)
    sha = (os.environ.get("GITHUB_SHA") or "").strip()[:7]
    message = f"deploy {sha}".strip() if sha else "manual deploy"
    api.upload_folder(
        repo_id=REPO_ID,
        repo_type="space",
        folder_path=".",
        commit_message=message,
        ignore_patterns=IGNORE_PATTERNS,
    )
    print(f"✓ uploaded repo to Space {REPO_ID} ({message})")


if __name__ == "__main__":
    main()
