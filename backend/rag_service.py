import os
import sys

# Ensure parent directory is in python path for absolute imports if executed directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import json
import uuid
import numpy as np
from openai import OpenAI
from backend.database import save_chunk_log, get_chunking_metrics

# Environment variables
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

# Initialize Nvidia client if key is present
nv_client = None
if NVIDIA_API_KEY:
    nv_client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=NVIDIA_API_KEY
    )

# Qdrant client fallback setup
qdrant_client = None
in_memory_db = [] # Fallback in-memory vector store: list of {"id": str, "vector": list, "payload": dict}

if QDRANT_URL:
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams
        
        q_client_args = {"url": QDRANT_URL}
        if QDRANT_API_KEY:
            q_client_args["api_key"] = QDRANT_API_KEY
        qdrant_client = QdrantClient(**q_client_args)
        
        # Ensure collection exists
        qdrant_client.recreate_collection(
            collection_name="requalitrace_guidelines",
            vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
        )
    except Exception as e:
        print(f"Failed to initialize QdrantClient (falling back to in-memory): {e}")
        qdrant_client = None

def get_embedding(text: str) -> list:
    """Generate embedding vector using Nvidia NIM, with a fallback to random vector."""
    if nv_client:
        try:
            response = nv_client.embeddings.create(
                input=[text],
                model="nvidia/embeddings-nv-embed-qa-4"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Nvidia embedding API failed, using fallback: {e}")
            
    # Mock embedding of size 1024 (hash-based for deterministic query matches in mock tests)
    h = hash(text)
    np.random.seed(abs(h) % 2**32)
    return np.random.uniform(-0.1, 0.1, 1024).tolist()

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list:
    """Splits text into chunks of chunk_size characters with overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start += (chunk_size - overlap)
    return chunks

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extracts raw text content from uploaded bytes depending on file type."""
    if filename.endswith(".json"):
        try:
            data = json.loads(file_content.decode("utf-8"))
            return json.dumps(data, indent=2)
        except:
            return file_content.decode("utf-8", errors="ignore")
    else:
        return file_content.decode("utf-8", errors="ignore")

def train_document_stream(file_content: bytes, filename: str):
    """
    Ingests and chunks a guideline document, saves progress to SQLite and Qdrant in real-time,
    and yields progressive state notifications for SSE stream.
    """
    text = extract_text_from_file(file_content, filename)
    chunks = chunk_text(text)
    total_chunks = len(chunks)
    
    yield {"status": "started", "total_chunks": total_chunks, "processed": 0}
    
    for idx, chunk in enumerate(chunks):
        # 1. Generate Embedding
        vector = get_embedding(chunk)
        token_count = len(chunk.split()) * 2 # Crude token approximation
        qdrant_id = str(uuid.uuid4())
        
        # 2. Save to SQLite database immediately
        save_chunk_log(filename, idx, chunk, token_count, qdrant_id)
        
        # 3. Save to Vector Store (Qdrant or In-Memory)
        payload = {
            "doc_name": filename,
            "chunk_index": idx,
            "text": chunk
        }
        
        if qdrant_client:
            try:
                from qdrant_client.models import PointStruct
                qdrant_client.upsert(
                    collection_name="requalitrace_guidelines",
                    points=[PointStruct(id=qdrant_id, vector=vector, payload=payload)]
                )
            except Exception as e:
                print(f"Qdrant upload failed for chunk {idx}: {e}")
        else:
            in_memory_db.append({
                "id": qdrant_id,
                "vector": vector,
                "payload": payload
            })
            
        # Simulate processing time slightly to make progress visual
        time.sleep(0.1)
        
        yield {
            "status": "processing",
            "total_chunks": total_chunks,
            "processed": idx + 1,
            "chunk": {
                "index": idx,
                "text": chunk[:150] + "...",
                "tokens": token_count
            }
        }
        
    metrics = get_chunking_metrics()
    yield {"status": "completed", "total_chunks": total_chunks, "metrics": metrics}

def search_guideline_chunks(query: str, limit: int = 5) -> list:
    """Searches the vector database for relevant guideline chunks using cosine similarity."""
    query_vector = get_embedding(query)
    
    if qdrant_client:
        try:
            results = qdrant_client.search(
                collection_name="requalitrace_guidelines",
                query_vector=query_vector,
                limit=limit
            )
            return [
                {
                    "text": hit.payload["text"],
                    "doc_name": hit.payload["doc_name"],
                    "score": hit.score
                }
                for hit in results
            ]
        except Exception as e:
            print(f"Qdrant search failed, falling back: {e}")
            
    # Fallback cosine similarity search on in-memory store
    matches = []
    qv = np.array(query_vector)
    qv_norm = np.linalg.norm(qv)
    
    for item in in_memory_db:
        iv = np.array(item["vector"])
        iv_norm = np.linalg.norm(iv)
        if qv_norm > 0 and iv_norm > 0:
            score = np.dot(qv, iv) / (qv_norm * iv_norm)
        else:
            score = 0.0
            
        matches.append({
            "text": item["payload"]["text"],
            "doc_name": item["payload"]["doc_name"],
            "score": float(score)
        })
        
    # Sort matches by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:limit]
