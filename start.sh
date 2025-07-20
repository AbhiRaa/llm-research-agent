#!/bin/bash
# Startup script for Railway deployment

# Set default port if not provided
export PORT=${PORT:-8000}

# Start the uvicorn server
uvicorn agent.server:app --host=0.0.0.0 --port=$PORT --proxy-headers