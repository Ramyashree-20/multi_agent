import os
from dotenv import load_dotenv
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.routes import router as api_router
from api.upload_routes import router as upload_router

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="Enterprise Document Intelligence OS",
    description="Multi-agent document analysis system with RAG pipeline",
    version="1.0.0",
)

# Static file serving for PDF previewing
os.makedirs("uploads", exist_ok=True)
app.mount("/files", StaticFiles(directory="uploads"), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload pipeline (new, production-grade)
app.include_router(upload_router, prefix="/api", tags=["Document Ingestion"])
# Query / agent routes
app.include_router(api_router, prefix="/api", tags=["Query & Agents"])

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Enterprise Doc AI API is running"}

from utils.exporter import create_pdf_report
from fastapi.responses import FileResponse
from pydantic import BaseModel

class ExportRequest(BaseModel):
    content: str
    filename: Optional[str] = "executive_brief.pdf"

@app.post("/api/export")
async def export_briefing(req: ExportRequest):
    """Generates and returns a PDF briefing."""
    path = create_pdf_report(req.content, req.filename)
    return FileResponse(path, media_type='application/pdf', filename=req.filename)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
