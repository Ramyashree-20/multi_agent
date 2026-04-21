"""
agents/graph.py
───────────────
Defines the multi-agent LangGraph workflow for the Enterprise Document AI system.
Includes Intent Classification, Supervisor Routing, specialized Worker Agents,
Validation, and Citation handling.
"""

import os
from typing import List, TypedDict, Dict, Any, Literal, Optional
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from rag.chroma_store import query_similar
from rag.document_loader import get_page_snapshot
import re

def extract_page_number(query: str) -> Optional[int]:
    """Extracts a page number from the query if mentioned (e.g. 'page 45', 'p.12')."""
    match = re.search(r'(?:page|p\.?)\s*:?\s*(\d+)', query, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None

# ──────────────────────────────────────────────
# State Definition
# ──────────────────────────────────────────────

class AgentState(TypedDict):
    """The graph state exchanged between agents."""
    query: str
    intent: str
    next_step: str
    context: List[Dict[str, Any]]  # List of {text, metadata}
    draft_response: str
    final_response: str
    is_grounded: bool
    confidence: float
    iterations: int  # To prevent infinite loops
    file_name: Optional[str]
    entities: List[Dict[str, Any]]


# ──────────────────────────────────────────────
# LLM Initialization
# ──────────────────────────────────────────────

from utils.llm import get_fast_llm, get_reasoning_llm

# ──────────────────────────────────────────────
# Agent Nodes
# ──────────────────────────────────────────────

def intent_agent(state: AgentState):
    """Classifies the user query into categories: Q&A, Summarisation, Comparison, or Other."""
    # Use fast model for classification
    llm = get_fast_llm()
    prompt = f"""
    Classify the user's intent for the following query:
    "{state['query']}"
    
    Choose exactly one from: ['QA', 'SUMMARIZE', 'COMPARE', 'GREETING', 'VISION']
    Choose 'VISION' if the user mentions charts, graphs, tables, trends, or visual analysis.
    Return ONLY the category name.
    """
    # Keyword fallback for precision
    keywords = ['chart', 'graph', 'trend', 'visual', 'figure', 'image']
    if any(k in state['query'].lower() for k in keywords):
        return {"intent": "VISION"}

    response = llm.invoke([HumanMessage(content=prompt)])
    intent = response.content.strip().upper()
    return {"intent": intent}


def supervisor_agent(state: AgentState):
    """Routes the task to the appropriate worker agent based on intent."""
    intent = state.get("intent", "QA")
    
    # Robust keyword override for Vision
    visual_keywords = ['chart', 'graph', 'trend', 'visual', 'figure', 'image', 'revenue growth']
    if any(k in state['query'].lower() for k in visual_keywords):
        return {"next_step": "vision"}
    
    if intent == "SUMMARIZE":
        return {"next_step": "summarizer"}
    elif intent == "COMPARE":
        return {"next_step": "compare"}
    elif intent == "GREETING":
         return {"next_step": "greet"}
    if intent == "VISION":
         # Smart page discovery for vision if not specified
         p_num = extract_page_number(state['query'])
         if p_num is None:
              v_search = query_similar("chart graph table figure", n_results=1, where_filter={"file_name": state.get("file_name")} if state.get("file_name") else None)
              if v_search.get("metadatas") and v_search["metadatas"][0]:
                  p_num = v_search["metadatas"][0][0].get("page_number", 1)
                  print(f"DISCOVERED CHART ON PAGE {p_num}")
         return {"next_step": "vision", "page_num": p_num}
    
    else:
        return {"next_step": "retriever"}


def retrieval_worker(state: AgentState):
    """Specialized agent for standard Q&A retrieval."""
    query = state["query"]
    target_file = state.get("file_name")
    p_num = extract_page_number(query)
    
    # Construct combined filter
    where_filter = {}
    filters = []
    if target_file: filters.append({"file_name": target_file})
    if p_num is not None: filters.append({"page_number": p_num})
    
    if len(filters) > 1: where_filter = {"$and": filters}
    elif len(filters) == 1: where_filter = filters[0]
    else: where_filter = None
    
    # Retrieve top 5 chunks
    raw_results = query_similar(query, n_results=5, where_filter=where_filter)
    
    documents = raw_results.get("documents", [[]])[0]
    metadatas = raw_results.get("metadatas", [[]])[0]
    
    context = []
    for doc, meta in zip(documents, metadatas):
        context.append({"text": doc, "metadata": meta})
    
    llm = get_reasoning_llm(temperature=0.2)
    context_str = "\n".join([f"Source: {c['metadata'].get('file_name')} (Page {c['metadata'].get('page_number')})\nContent: {c['text']}" for c in context])
    
    prompt = f"""
    Answer the user query based ONLY on the provided context. 
    Query: {query}
    Context: {context_str}
    
    If context is insufficient, state exactly what's missing.
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    return {"context": context, "draft_response": response.content, "iterations": state.get("iterations", 0) + 1}


def summarizer_worker(state: AgentState):
    """Specialized agent for document summarization."""
    query = state["query"]
    target_file = state.get("file_name")
    p_num = extract_page_number(query)

    where_filter = {}
    filters = []
    if target_file: filters.append({"file_name": target_file})
    if p_num is not None: filters.append({"page_number": p_num})
    
    if len(filters) > 1: where_filter = {"$and": filters}
    elif len(filters) == 1: where_filter = filters[0]
    else: where_filter = None

    # For summarization, we retrieve relevant broad chunks
    raw_results = query_similar(query, n_results=10, where_filter=where_filter)
    documents = raw_results.get("documents", [[]])[0]
    metadatas = raw_results.get("metadatas", [[]])[0]
    
    context = [{"text": d, "metadata": m} for d, m in zip(documents, metadatas)]
    
    llm = get_reasoning_llm(temperature=0.3)
    text_to_summarize = "\n".join(documents)
    
    prompt = f"""
    Provide a comprehensive executive summary of the following document sections:
    {text_to_summarize}
    
    Focus on key metrics, decisions, and outcomes.
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    return {"context": context, "draft_response": response.content, "iterations": state.get("iterations", 0) + 1}


def compare_worker(state: AgentState):
    """Specialized agent for comparing documents."""
    query = state["query"]
    target_file = state.get("file_name")
    p_num = extract_page_number(query)

    where_filter = {}
    filters = []
    if target_file: filters.append({"file_name": target_file})
    if p_num is not None: filters.append({"page_number": p_num})
    
    if len(filters) > 1: where_filter = {"$and": filters}
    elif len(filters) == 1: where_filter = filters[0]
    else: where_filter = None

    raw_results = query_similar(query, n_results=10, where_filter=where_filter)
    documents = raw_results.get("documents", [[]])[0]
    metadatas = raw_results.get("metadatas", [[]])[0]
    
    context = [{"text": d, "metadata": m} for d, m in zip(documents, metadatas)]
    
    llm = get_reasoning_llm(temperature=0.1)
    prompt = f"""
    Using the context below, compare and contrast the different entities or reports mentioned.
    Context: {" ".join(documents)}
    Query: {query}
    """
    response = llm.invoke([HumanMessage(content=prompt)])
    return {"context": context, "draft_response": response.content, "iterations": state.get("iterations", 0) + 1}


def simple_greet(state: AgentState):
    """Handles basic greetings without RAG."""
    return {"draft_response": "Hello! I am your Enterprise Document AI. How can I help you analyze your documents today?"}


def validation_agent(state: AgentState):
    """Verifies that the draft response is grounded in the retrieved context."""
    context = state.get("context", [])
    response = state.get("draft_response", "")
    intent = state.get("intent", "QA")
    
    # Vision responses are grounded in visual content, which the text validator can't see
    if intent == "VISION":
         return {"is_grounded": True, "confidence": 0.95}

    if not context:
        return {"is_grounded": True} # Greet or No Context

    llm = get_reasoning_llm()
    context_text = "\n".join([c["text"] for c in context])
    
    prompt = f"""
    Fact-check the following assistant response against the provided context.
    Response: {response}
    Context: {context_text}
    
    Is the response fully supported by the context? Answer 'YES' or 'NO'. 
    If NO, explain why.
    """
    check = llm.invoke([HumanMessage(content=prompt)])
    is_grounded = "YES" in check.content.upper()
    confidence = 0.98 if is_grounded else 0.25
    
    return {"is_grounded": is_grounded, "confidence": confidence}


def citation_agent(state: AgentState):
    """Formats the final response and appends precise source metadata."""
    response = state.get("draft_response", "")
    context = state.get("context", [])
    
    if not context:
        return {"final_response": response}

    sources = set()
    for c in context:
        fname = c["metadata"].get("file_name", "Unknown File")
        pnum = c["metadata"].get("page_number", "?")
        sources.add(f"{fname} (p. {pnum})")
    
    citation_footer = "\n\n**Sources:**\n- " + "\n- ".join(sorted(list(sources)))
    
    return {"final_response": response + citation_footer, "entities": state.get("entities", [])}


def entity_extractor_worker(state: AgentState):
    """Extracts people, organizations, and relationships for the knowledge graph."""
    context = state.get("context", [])
    if not context:
        return {"entities": []}
        
    llm = get_fast_llm() # Using fast model for extraction
    context_text = "\n".join([c["text"] for c in context[:3]]) # Focus on top chunks
    
    prompt = f"""
    Extract key entities and their relationships from the text below.
    Format your output as a valid JSON list of objects with keys: "name", "type" (PERSON, ORG, DATE), and "relation" (who they are connected to in this text).
    
    Text: {context_text}
    
    ONLY return the JSON list. No preamble.
    """
    
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        import json
        # Basic cleanup in case LLM adds markdown
        clean_json = response.content.replace('```json', '').replace('```', '').strip()
        entities = json.loads(clean_json)
        return {"entities": entities}
    except:
        return {"entities": []}


def vision_worker(state: AgentState):
    """Specialized worker for analyzing charts and tables using Llama 3.2 Vision."""
    query = state["query"]
    target_file = state.get("file_name")
    # Use page discovered by supervisor or extract from query
    p_num = state.get("page_num") or extract_page_number(query) or 1
    
    if not target_file:
         return {"draft_response": "Please specify or upload a document first for visual analysis."}
    
    # Get base64 image of the page
    from utils.llm import get_vision_llm
    b64_image = get_page_snapshot(os.path.join("uploads", target_file), p_num)
    
    if not b64_image:
         return {"draft_response": f"Failed to capture a visual snapshot of page {p_num} for analysis."}
    
    llm = get_vision_llm(temperature=0.1)
    
    # Construct multimodal message
    from langchain_core.messages import HumanMessage
    msg = HumanMessage(content=[
        {"type": "text", "text": f"Analyze this document page and answer the query: {query}"},
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_image}"}}
    ])
    
    try:
        response = llm.invoke([msg])
        ans = response.content.strip() if response.content else "I saw the page but couldn't interpret the specific data."
        
        # Add a dummy context so the citation agent shows the "Source" for vision
        visual_context = [{
            "text": "[Visual Analysis performed on this page]",
            "metadata": {"file_name": target_file, "page_number": p_num}
        }]
        
        return {
            "draft_response": ans, 
            "context": visual_context,
            "iterations": state.get("iterations", 0) + 1
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"CRITICAL VISION ERROR: {error_trace}")
        return {"draft_response": f"AI Vision Agent encountered an error: {str(e)}", "context": []}


# ──────────────────────────────────────────────
# Graph Construction
# ──────────────────────────────────────────────

def router_logic(state: AgentState) -> Literal["retriever", "summarizer", "compare", "greet", "vision"]:
    return state["next_step"]

def validation_router(state: AgentState) -> Literal["entities", "retriever"]:
    # If not grounded, we try to retrieve again
    if state.get("is_grounded") or state.get("iterations", 0) > 1:
        return "entities"
    return "retriever"

builder = StateGraph(AgentState)

# Add Nodes
builder.add_node("intent", intent_agent)
builder.add_node("supervisor", supervisor_agent)
builder.add_node("retriever", retrieval_worker)
builder.add_node("summarizer", summarizer_worker)
builder.add_node("compare", compare_worker)
builder.add_node("vision", vision_worker)
builder.add_node("greet", simple_greet)
builder.add_node("validator", validation_agent)
builder.add_node("entities", entity_extractor_worker)
builder.add_node("citation", citation_agent)

# Set Entry Point
builder.set_entry_point("intent")

# Edges
builder.add_edge("intent", "supervisor")

# Conditional Edges from Supervisor
builder.add_conditional_edges(
    "supervisor",
    router_logic,
    {
        "retriever": "retriever",
        "summarizer": "summarizer",
        "compare": "compare",
        "greet": "greet",
        "vision": "vision"
    }
)

# Workers go to validation
builder.add_edge("retriever", "validator")
builder.add_edge("summarizer", "validator")
builder.add_edge("compare", "validator")
builder.add_edge("vision", "validator")
builder.add_edge("greet", "citation") # Greet skips validation usually

# Validation logic
builder.add_conditional_edges(
    "validator",
    validation_router,
    {
        "entities": "entities",
        "retriever": "retriever"
    }
)
builder.add_edge("entities", "citation")
builder.add_edge("citation", END)

# Compile
workflow_graph = builder.compile()
