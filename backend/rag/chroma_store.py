"""
chroma_store.py
───────────────
Manages the ChromaDB vector store for the Enterprise Document AI system.

Responsibilities:
  1. Initialise / connect to a persistent ChromaDB collection.
  2. Generate embeddings with ``SentenceTransformer('all-MiniLM-L6-v2')``.
  3. Upsert document chunks together with their metadata.
  4. Expose a retriever for downstream RAG queries.
"""

from __future__ import annotations

import os
import uuid
from typing import Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from rag.document_loader import DocumentChunk


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "chroma_db")
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION", "enterprise_docs")
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


# ──────────────────────────────────────────────
# Singleton helpers (thread-safe lazy init)
# ──────────────────────────────────────────────

_embedding_model: Optional[SentenceTransformer] = None
_chroma_client: Optional[chromadb.ClientAPI] = None
_collection: Optional[chromadb.Collection] = None


def _get_embedding_model() -> SentenceTransformer:
    """Lazily load the SentenceTransformer model once."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


def _get_chroma_client() -> chromadb.ClientAPI:
    """Lazily create or reuse a persistent ChromaDB client."""
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    return _chroma_client


def _get_collection() -> chromadb.Collection:
    """Get or create the default ChromaDB collection."""
    global _collection
    if _collection is None:
        client = _get_chroma_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate dense vector embeddings for a list of text strings using
    ``SentenceTransformer('all-MiniLM-L6-v2')``.

    Returns a list of float vectors (one per input text).
    """
    model = _get_embedding_model()
    embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    return embeddings.tolist()


def store_chunks(chunks: List[DocumentChunk]) -> int:
    """
    Embed and upsert a batch of ``DocumentChunk`` objects into ChromaDB.

    Each chunk is stored with:
      - A unique UUID-based ID
      - Its embedding vector
      - Metadata dict  (file_name, chunk_index, page_number)

    Returns the number of chunks successfully stored.
    """
    if not chunks:
        return 0

    collection = _get_collection()

    texts = [c.text for c in chunks]
    metadatas = [c.metadata for c in chunks]
    ids = [str(uuid.uuid4()) for _ in chunks]
    embeddings = generate_embeddings(texts)

    collection.upsert(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)


def query_similar(
    query_text: str,
    n_results: int = 4,
    where_filter: Optional[Dict] = None,
) -> dict:
    """
    Retrieve the most similar chunks for a given query string.

    Parameters
    ----------
    query_text : str
        Natural-language query.
    n_results : int
        Number of results to return.
    where_filter : dict, optional
        ChromaDB metadata filter, e.g. ``{"file_name": "report.pdf"}``.

    Returns
    -------
    dict
        Raw ChromaDB query result containing ``ids``, ``documents``,
        ``metadatas``, and ``distances``.
    """
    collection = _get_collection()
    query_embedding = generate_embeddings([query_text])

    query_params: dict = {
        "query_embeddings": query_embedding,
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if where_filter:
        query_params["where"] = where_filter

    return collection.query(**query_params)


def get_collection_count() -> int:
    """Return the total number of vectors currently stored."""
    return _get_collection().count()
