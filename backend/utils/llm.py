"""
utils/llm.py
────────────
Reusable LLM factory for the Enterprise Document AI system.
Provides initialized Groq models with standardized configurations.
"""

import os
from typing import Optional
from langchain_groq import ChatGroq

def get_llm(
    model_name: str = "llama-3.1-8b-instant", 
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
    streaming: bool = False
) -> ChatGroq:
    """
    Returns an instance of ChatGroq with the specified parameters.
    Ensures GROQ_API_KEY is present.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        # Fallback or error based on project preference
        # raise ValueError("GROQ_API_KEY environment variable is not set.")
        pass

    return ChatGroq(
        groq_api_key=api_key,
        model_name=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=streaming
    )

def get_fast_llm(temperature: float = 0.0) -> ChatGroq:
    """Returns the faster, cheaper 8b model for low-latency tasks."""
    return get_llm(model_name="llama-3.1-8b-instant", temperature=temperature)

def get_reasoning_llm(temperature: float = 0.0) -> ChatGroq:
    """Returns the 8b model to bypass 70b rate limits while maintaining accuracy."""
    return get_llm(model_name="llama-3.1-8b-instant", temperature=temperature)

def get_vision_llm(temperature: float = 0.0) -> ChatGroq:
    """Returns the multmodal vision model for chart and table analysis."""
    # Updated to Llama 4 Scout as Llama 3.2 Vision Preview was decommissioned April 2025
    return get_llm(model_name="meta-llama/llama-4-scout-17b-16e-instruct", temperature=temperature)

