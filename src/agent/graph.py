"""
Very first stub – returns a canned answer so tests can pass.
Later we'll replace this with a real LangGraph pipeline.
"""
import asyncio
from typing import Dict, Any


async def answer_question(question: str) -> Dict[str, Any]:
    # Minimal hard-coded JSON in the target format
    return {
        "answer": "Stub answer for: " + question + " [1]",
        "citations": [
            {
                "id": 1,
                "title": "Example citation",
                "url": "https://example.com",
            }
        ],
    }


# Convenience synchronous wrapper for unit tests
def answer_sync(question: str) -> Dict[str, Any]:
    return asyncio.run(answer_question(question))
