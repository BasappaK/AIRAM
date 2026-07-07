import os
import sys
import uuid
import json
import time

from Model.llm import LLMManager
from RagEngine.rag_engine import RAGEngine
from backend.database import save_chunk_log, get_chunking_metrics, clear_chunks_for_doc

# Initialize global LLMManager and RAGEngine
llm_manager = LLMManager()
rag_engine = RAGEngine(llm_manager=llm_manager)

def train_document_stream(
    file_content: bytes, 
    filename: str, 
    collection_name: str = "aaram_guidelines",
    collection_mode: str = "create",
    start_page: int = None,
    end_page: int = None
):
    """
    Ingests and chunks a guideline document using RAGEngine, saves progress to SQLite and Qdrant in real-time,
    and yields progressive state notifications for SSE stream.
    """
    # 1. Clear database entries for this document to avoid duplicate chunks
    clear_chunks_for_doc(filename)
    
    # 2. Setup the collection
    recreate = collection_mode == "create"
    rag_engine.setup_collection(collection_name, recreate=recreate)
    
    # 3. Process the file using RAGEngine (Excel, CSV, text, PDF)
    # Temporarily isolate newly processed documents
    prev_docs = list(rag_engine.documents)
    prev_vecs = list(rag_engine.vectors)
    rag_engine.documents = []
    rag_engine.vectors = []
    
    try:
        rag_engine.process_file(
            filename, 
            file_content, 
            collection_name=collection_name,
            start_page=start_page,
            end_page=end_page
        )
        new_docs = list(rag_engine.documents)
    finally:
        # Restore previous documents and merge
        rag_engine.documents = prev_docs + rag_engine.documents
        rag_engine.vectors = prev_vecs + rag_engine.vectors
        
    total_chunks = len(new_docs)
    
    yield {"status": "started", "total_chunks": total_chunks, "processed": 0}
    
    for idx, doc in enumerate(new_docs):
        # Generate Embedding using LLMManager via RAGEngine's _safe_get_embedding
        vector = rag_engine._safe_get_embedding(doc["text"])
        token_count = len(doc["text"].split()) * 2 # Crude token approximation
        
        # Save to SQLite database
        save_chunk_log(filename, idx, doc["text"], token_count, doc["id"])
        
        # Save to Vector Store (Qdrant or In-Memory)
        payload = {
            "title": doc.get("title", "Untitled"),
            "text": doc["text"],
            "source": doc.get("source", filename),
            "collection": collection_name,
            "metadata": doc.get("metadata", {})
        }
        
        if rag_engine.qdrant_client:
            try:
                from qdrant_client.models import PointStruct
                rag_engine.qdrant_client.upsert(
                    collection_name=collection_name,
                    points=[PointStruct(id=doc["id"], vector=vector, payload=payload)]
                )
            except Exception as e:
                print(f"Qdrant upload failed for chunk {idx}: {e}")
                
        # Find index in total list to update vector alignment
        existing_idx = None
        for i, d in enumerate(rag_engine.documents):
            if d.get("id") == doc["id"]:
                existing_idx = i
                break
                
        if existing_idx is not None:
            if existing_idx < len(rag_engine.vectors):
                rag_engine.vectors[existing_idx] = vector
            else:
                rag_engine.vectors.append(vector)
        else:
            rag_engine.documents.append(doc)
            rag_engine.vectors.append(vector)
            
        time.sleep(0.05) # Yield slightly for UI visual progress
        
        yield {
            "status": "processing",
            "total_chunks": total_chunks,
            "processed": idx + 1,
            "chunk": {
                "index": idx,
                "text": doc["text"][:150] + "...",
                "tokens": token_count
            }
        }
        
    metrics = get_chunking_metrics()
    yield {"status": "completed", "total_chunks": total_chunks, "metrics": metrics}

def search_guideline_chunks(query: str, limit: int = 5, collection_name: str = "aaram_guidelines") -> list:
    """Searches the vector database for relevant guideline chunks using RAGEngine."""
    try:
        results = rag_engine.search(query, collection_name=collection_name, top_k=limit)
        return [
            {
                "text": r["payload"]["text"],
                "doc_name": r["payload"].get("source", ""),
                "score": r["score"]
            }
            for r in results
        ]
    except Exception as e:
        print(f"Search chunks failed: {e}")
        return []
