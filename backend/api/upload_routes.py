"""
upload_routes.py
────────────────
FastAPI router for the ``/upload`` document ingestion endpoint.

Flow:
  1. Validate the uploaded file extension.
  2. Persist the file to disk (``uploads/`` directory).
  3. Extract text page-by-page   → ``document_loader.extract_pages``
  4. Split into overlapping chunks → ``document_loader.split_into_chunks``
  5. Embed & store in ChromaDB    → ``chroma_store.store_chunks``
  6. Return a success response with chunk count and metadata.
"""

from __future__ import annotations

import os
import time
from typing import Set

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from rag.document_loader import (
    SUPPORTED_EXTENSIONS,
    extract_pages,
    split_into_chunks,
)
from rag.chroma_store import store_chunks, get_collection_count

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Chunk tuning knobs – can later be promoted to query params or env vars
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def _validate_extension(filename: str) -> str:
    """Return the lowercased extension or raise 400."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Accepted: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            ),
        )
    return ext


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a document (PDF / DOCX / TXT), extract text, chunk it, embed it,
    and persist the vectors in ChromaDB.

    **Returns** JSON with:
      - ``filename`` – name of the uploaded file
      - ``num_pages`` – number of logical pages extracted
      - ``num_chunks`` – number of chunks stored in ChromaDB
      - ``total_vectors`` – total vector count in the collection after insert
      - ``processing_time_s`` – wall-clock time in seconds
    """
    # ── 1. Basic validation ──────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    _validate_extension(file.filename)

    # ── 2. Save to disk ──────────────────────────────────────
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save uploaded file: {exc}",
        )

    # ── 3-5. Extract → Chunk → Embed & Store ─────────────────
    start = time.perf_counter()
    try:
        pages = extract_pages(file_path)
        chunks = split_into_chunks(
            pages,
            file_name=file.filename,
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )
        # Run CPU-bound embedding in a threadpool to avoid blocking the event loop
        stored_count = await run_in_threadpool(store_chunks, chunks)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {exc}",
        )
    elapsed = round(time.perf_counter() - start, 3)

    # ── 6. Success response ──────────────────────────────────
    return {
        "status": "success",
        "filename": file.filename,
        "num_pages": len(pages),
        "num_chunks": stored_count,
        "total_vectors": get_collection_count(),
        "processing_time_s": elapsed,
    }
