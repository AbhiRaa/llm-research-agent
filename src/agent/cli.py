"""
CLI entry point for the (stub) LLM Research Agent.
For now it returns a fixed JSON so we have something testable.
"""
import json, sys, asyncio
from .graph import answer_question


async def _run(question: str):
    result = await answer_question(question)
    # Pretty-print as JSON
    print(json.dumps(result, indent=2))


def main() -> None:
    if len(sys.argv) < 2:
        print('Usage: agent "<your question>"', file=sys.stderr)
        sys.exit(1)
    question = " ".join(sys.argv[1:])
    asyncio.run(_run(question))


if __name__ == "__main__":
    main()
