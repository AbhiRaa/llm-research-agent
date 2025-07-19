# Deployment Guide

This project consists of two parts:
1. **Backend**: Python FastAPI server (deployed on Railway)
2. **Frontend**: React/Vite app (deployed on Vercel)

## Backend Deployment (Railway)

1. Push to production branch: `git push origin production`
2. Go to [Railway](https://railway.app)
3. Create new project from GitHub
4. Select this repository and the `production` branch
5. Railway will automatically detect the Dockerfile and deploy

**Environment Variables needed:**
- `OPENAI_API_KEY` (if using real LLM)
- `SERPER_API_KEY` or `BING_API_KEY` (for web search)

## Frontend Deployment (Vercel)

1. Go to [Vercel](https://vercel.com)
2. Import the repository
3. Set root directory to `web-agent`
4. Deploy

The frontend will automatically use the production API URL.

## Local Development

Backend:
```bash
docker compose up -d redis
uvicorn src.agent.server:app --host=0.0.0.0 --port=8001 --reload
```

Frontend:
```bash
cd web-agent
npm install
npm run dev
```