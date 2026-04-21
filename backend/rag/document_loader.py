"""
document_loader.py
──────────────────
Responsible for:
  1. Extracting raw text from PDF / DOCX / TXT files.
  2. Splitting the extracted text into overlapping chunks via LangChain.
  3. Attaching rich metadata (file_name, chunk_index, page_number) to every chunk.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Optional

import fitz  # PyMuPDF
import docx
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter


# ──────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────

@dataclass
class PageContent:
    """Holds the text of a single logical page together with its page number."""
    text: str
    page_number: int


@dataclass
class DocumentChunk:
    """A single chunk ready to be embedded and stored."""
    text: str
    metadata: dict = field(default_factory=dict)


# ──────────────────────────────────────────────
# Extraction helpers  (one per file type)
# ──────────────────────────────────────────────

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def _extract_pdf(file_path: str) -> List[PageContent]:
    """Extract text page-by-page from a PDF using PyMuPDF."""
    pages: List[PageContent] = []
    doc = fitz.open(file_path)
    for page_idx, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            pages.append(PageContent(text=text, page_number=page_idx + 1))
    doc.close()
    return pages


def _extract_docx(file_path: str) -> List[PageContent]:
    """
    Extract text from a DOCX file.
    Word documents don't have a native page concept, so we treat sections
    separated by page-break runs as distinct pages.  If no page breaks are
    found the entire document is returned as page 1.
    """
    document = docx.Document(file_path)
    pages: List[PageContent] = []
    current_text_parts: List[str] = []
    current_page = 1

    for para in document.paragraphs:
        # Detect hard page breaks inside runs
        has_page_break = False
        for run in para.runs:
            if run._element.xml and "w:br" in run._element.xml and 'type="page"' in run._element.xml:
                has_page_break = True
                break

        if has_page_break and current_text_parts:
            pages.append(PageContent(
                text="\n".join(current_text_parts),
                page_number=current_page,
            ))
            current_text_parts = []
            current_page += 1

        if para.text.strip():
            current_text_parts.append(para.text)

    # Flush remaining text
    if current_text_parts:
        pages.append(PageContent(
            text="\n".join(current_text_parts),
            page_number=current_page,
        ))

    return pages


def _extract_txt(file_path: str) -> List[PageContent]:
    """Read a plain-text file as a single logical page."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    if text.strip():
        return [PageContent(text=text, page_number=1)]
    return []


_EXTRACTORS = {
    ".pdf": _extract_pdf,
    ".docx": _extract_docx,
    ".txt": _extract_txt,
}


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def extract_pages(file_path: str) -> List[PageContent]:
    """
    Detect the file type and return a list of ``PageContent`` objects.

    Raises ``ValueError`` for unsupported extensions.
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in _EXTRACTORS:
        raise ValueError(
            f"Unsupported file extension '{ext}'. "
            f"Accepted types: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    return _EXTRACTORS[ext](file_path)


def split_into_chunks(
    pages: List[PageContent],
    file_name: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[DocumentChunk]:
    """
    Split page-level text into smaller overlapping chunks using LangChain's
    ``RecursiveCharacterTextSplitter`` and attach metadata to each chunk.

    Metadata per chunk:
      - ``file_name``   – original uploaded file name
      - ``chunk_index``  – zero-based index across the whole document
      - ``page_number`` – source page the chunk originated from
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks: List[DocumentChunk] = []
    global_chunk_idx = 0

    for page in pages:
        page_splits = splitter.split_text(page.text)
        for split_text in page_splits:
            chunks.append(DocumentChunk(
                text=split_text,
                metadata={
                    "file_name": file_name,
                    "chunk_index": global_chunk_idx,
                    "page_number": page.page_number,
                },
            ))
            global_chunk_idx += 1

    return chunks


def load_and_split(
    file_path: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[DocumentChunk]:
    """
    Convenience wrapper: extract pages **and** split into chunks in one call.
    The file name is derived from ``file_path``.
    """
    file_name = os.path.basename(file_path)
    pages = extract_pages(file_path)
    return split_into_chunks(pages, file_name, chunk_size, chunk_overlap)


def get_page_snapshot(file_path: str, page_number: int) -> Optional[str]:
    """
    Render a specific PDF page to an image and return as a Base64 string.
    Useful for feeding charts/tables to Llama 3.2 Vision.
    """
    import base64
    try:
        doc = fitz.open(file_path)
        # Page numbers in fitz are 0-indexed, our system uses 1-indexed
        page = doc.load_page(page_number - 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # 2x zoom for clarity
        img_bytes = pix.tobytes("png")
        doc.close()
        return base64.b64encode(img_bytes).decode("utf-8")
    except Exception as e:
        print(f"Vision Snapshot Error: {e}")
        return None
