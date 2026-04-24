"""
routes.py
─────────
General-purpose API routes (query, health, etc.).
Upload functionality lives in ``upload_routes.py``.
"""

from fastapi import APIRouter, HTTPException

from agents.workflow import process_query_workflow

router = APIRouter()


@router.post("/query")
async def query_documents(query: str, file_name: str = None):
    """
    Send a natural-language query against the ingested document corpus.
    Dynamically routes through specialized agents (QA, Summarize, Compare).
    """
    try:
        result = process_query_workflow(query, file_name=file_name)
        
        # Extract metadata from context for sources
        sources = []
        seen_sources = set()
        for ctx in result.get("context", []):
            meta = ctx.get("metadata", {})
            source_id = f"{meta.get('file_name')}_{meta.get('page_number')}"
            if source_id not in seen_sources:
                sources.append({
                    "file": meta.get("file_name"),
                    "page": meta.get("page_number")
                })
                seen_sources.add(source_id)

        return {
            "answer": result.get("final_response"),
            "citations_text": result.get("citations_text"),
            "agent_used": result.get("next_step", "retriever"),
            "sources": sources,
            "confidence": result.get("confidence", 0.0),
            "entities": result.get("entities", [])
        }
    except Exception as e:
        import traceback
        print(f"DEBUG ERROR in /query: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
