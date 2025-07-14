import asyncio, json
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from .graph import answer_question   # existing helper

app = FastAPI(title="LLM Research Agent (streaming)")

# ---- internal helper -------------------------------------------------
async def _run_stream(question: str):
    """
    Async generator that yields incremental JSON strings.

    For now we fake token streaming by sending the final answer in
    50-character chunks. Replace with real token callbacks later.
    """
    result = await answer_question(question)
    answer = result["answer"]
    citations = result["citations"]

    # naive chunking for PoC
    for i in range(0, len(answer), 50):
        chunk = answer[i : i + 50]
        yield f"event: token\ndata: {json.dumps({'text': chunk})}\n\n"
        await asyncio.sleep(0.02)      # tiny delay so clients see streaming

    payload = {"answer": answer, "citations": citations}
    yield f"event: done\ndata: {json.dumps(payload)}\n\n"


# ---- SSE endpoint ----------------------------------------------------
@app.get("/api/stream")
async def sse_endpoint(question: str, request: Request):
    async def _event_gen():
        try:
            async for chunk in _run_stream(question):
                # Drop connection if client went away
                if await request.is_disconnected():
                    break
                yield chunk
        finally:
            # ensures generator close
            pass

    headers = {"Content-Type": "text/event-stream", "Cache-Control": "no-cache"}
    return StreamingResponse(_event_gen(), headers=headers)


# ---- WebSocket endpoint ---------------------------------------------
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        query = ws.query_params.get("question")
        if not query:
            await ws.close(code=4000)
            return

        async for chunk in _run_stream(query):
            # strip the SSE framing so WS just gets JSON objects
            if chunk.startswith("event: token"):
                _, data_line, _ = chunk.splitlines()
                await ws.send_text(data_line[6:])         # after "data: "
            elif chunk.startswith("event: done"):
                _, data_line, _ = chunk.splitlines()
                await ws.send_text(data_line[6:])
                await ws.close(code=1000)
    except WebSocketDisconnect:
        pass
