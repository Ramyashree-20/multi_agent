"""
agents/workflow.py
──────────────────
Entry point for the LangGraph multi-agent workflow.
Invokes the graph defined in agents/graph.py.
"""

from agents.graph import workflow_graph

def process_query_workflow(query: str, file_name: str = None) -> dict:
    """
    Executes the multi-agent graph for a user query and returns the 
    complete result state.
    """
    initial_state = {
        "query": query,
        "file_name": file_name,
        "intent": "",
        "next_step": "",
        "context": [],
        "draft_response": "",
        "final_response": "",
        "citations_text": "",
        "is_grounded": False,
        "confidence": 0.0,
        "iterations": 0,
        "entities": []
    }
    
    # Run the graph
    result = workflow_graph.invoke(initial_state)
    return result
