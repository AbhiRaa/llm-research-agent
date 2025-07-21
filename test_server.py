#!/usr/bin/env python3
"""
Minimal FastAPI test server to verify Railway deployment works
"""
import os
from fastapi import FastAPI

app = FastAPI(title="Railway Test")

@app.get("/")
def root():
    return {
        "message": "Railway test server running",
        "port": os.environ.get("PORT", "not set"),
        "python_path": os.environ.get("PYTHONPATH", "not set")
    }

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)