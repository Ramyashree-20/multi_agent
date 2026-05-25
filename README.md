# Enterprise Document Intelligence AI

A production-ready multi-agent system for analyzing enterprise documents (PDF, DOCX, TXT) using LangGraph, ChromaDB, and Groq.

## Project Structure

```text
enterprise_doc_ai/
├── backend/
│   ├── agents/          # LangGraph Multi-Agent implementation
│   │   ├── graph.py     # Graph definition (Supervisor, Intent, Workers)
│   │   └── workflow.py  # Graph entry point 
│   ├── api/             # FastAPI Endpoints
│   │   ├── routes.py    # Query endpoint
│   │   └── upload_routes.py # Ingestion pipeline
│   ├── rag/             # RAG logic (ChromaDB + Loader)
│   ├── utils/           # LLM utilities
│   ├── main.py          # App entry point
│   └── .env             # Environment variables (API Keys)
├── frontend/            # React + Tailwind + Framer Motion
└── .gitignore
```

## Setup Instructions

### Backend
1. `cd backend`
2. `python -m venv venv`
3. `venv\Scripts\activate`
4. `pip install -r requirements.txt`
5. Create `.env` and add your `GROQ_API_KEY`.
6. `uvicorn main:app --reload`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Deploy Option A — Free demo with Vercel + Replit
1. Push your repository to GitHub.
2. In `frontend/src/App.tsx`, the app now uses `VITE_API_BASE_URL` when available.
3. Deploy the frontend on Vercel:
   - Connect your repo to Vercel.
   - Set the project root to `frontend`.
   - Build command: `npm run build`
   - Output directory: `dist`
   - Add an environment variable `VITE_API_BASE_URL` with your backend URL, for example `https://your-backend.repl.co/api`.
4. Deploy the backend on Replit:
   - Create a new Repl (Python) and import your repo, or use the `backend` folder.
   - Set the run command to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
   - Add Replit secrets: `GROQ_API_KEY` and any other keys your backend needs.
   - Start the Repl and note the public URL.
5. Set Vercel `VITE_API_BASE_URL` to `https://<your-repl>.repl.co/api`.
6. Open the deployed frontend URL and verify it calls the backend.

### Notes
- Keep API keys out of GitHub. Use Replit secrets and Vercel environment variables.
- The backend stores uploads and ChromaDB locally in Replit, so this is best for demos, not production.

## Features
- **Multi-Agent Orchestration**: Intent classification and specialized routing.
- **Deep Extraction**: Page-aware text processing for PDF and Word.
- **Fact Validation**: Agentic grounding check against retrieved chunks.
- **Dynamic Visualization**: Real-time workflow tracking in the UI.
