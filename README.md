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

## Features
- **Multi-Agent Orchestration**: Intent classification and specialized routing.
- **Deep Extraction**: Page-aware text processing for PDF and Word.
- **Fact Validation**: Agentic grounding check against retrieved chunks.
- **Dynamic Visualization**: Real-time workflow tracking in the UI.
