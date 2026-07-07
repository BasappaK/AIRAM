import os
import sys
import uuid
import json
import asyncio
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Ensure backend directory is in python path to support Model, Analysis, RagEngine imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)
sys.path.append(os.path.dirname(backend_dir))

# Load environment variables
load_dotenv(os.path.join(backend_dir, ".env"))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from backend.database import (
    init_db,
    save_guidelines,
    get_all_guidelines,
    get_previous_executions,
    get_execution_results,
    update_execution_minimized,
    update_execution_status,
    get_chunking_metrics,
    delete_execution_run
)
from backend.rag_service import train_document_stream, search_guideline_chunks
from backend.analyzer_service import run_requirements_analysis_job, ACTIVE_JOBS

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="AARAM Backend", lifespan=lifespan)

# Enable CORS for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development compatibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/api/ws/status")
async def websocket_status(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass

@app.post("/api/guidelines/upload")
async def upload_guidelines(
    name: str = Form(...),
    file: UploadFile = File(...)
):
    """Uploads rules guidelines (like INCOSE, ASPICE) in JSON format."""
    try:
        content = await file.read()
        parsed_json = json.loads(content.decode("utf-8-sig"))
        guideline_id = str(uuid.uuid4())
        save_guidelines(guideline_id, name, parsed_json)
        return {"status": "success", "id": guideline_id, "name": name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file structure: {str(e)}")

@app.get("/api/guidelines")
async def get_guidelines():
    """Lists all available strict guideline documents."""
    return get_all_guidelines()

@app.post("/api/rag/train")
async def train_rag(
    file: UploadFile = File(...),
    collection_name: str = Form("requalitrace_guidelines"),
    collection_mode: str = Form("create"),
    start_page: str = Form(None),
    end_page: str = Form(None)
):
    """
    Progressively processes and chunks a guideline file,
    streaming chunk logs and chunking metrics to the frontend in real time.
    """
    filename = file.filename
    content = await file.read()
    
    s_page = int(start_page) if start_page and start_page.strip().isdigit() else None
    e_page = int(end_page) if end_page and end_page.strip().isdigit() else None
    
    async def sse_generator():
        for state in train_document_stream(
            content, 
            filename, 
            collection_name=collection_name,
            collection_mode=collection_mode,
            start_page=s_page,
            end_page=e_page
        ):
            yield f"data: {json.dumps(state)}\n\n"
            await asyncio.sleep(0.01) # Yield thread
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.post("/api/rag/inspect-pdf")
async def inspect_pdf(file: UploadFile = File(...)):
    """Inspects an uploaded PDF and returns its page count."""
    try:
        content = await file.read()
        try:
            import fitz
        except ImportError:
            import pymupdf as fitz
        doc = fitz.open(stream=content, filetype="pdf")
        return {"pages": len(doc)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to inspect PDF: {str(e)}")

@app.get("/api/rag/collections")
async def get_rag_collections():
    """Lists all active RAG vector database collections."""
    from backend.rag_service import rag_engine
    return rag_engine.get_collections()

@app.get("/api/rag/metrics")
async def get_rag_metrics():
    """Retrieves current vector DB chunking metrics."""
    return get_chunking_metrics()

@app.get("/api/rag/search")
async def search_rag(query: str, limit: int = 5, collection_name: str = "requalitrace_guidelines"):
    """Search endpoint to manually evaluate chunking and relevance retrieval."""
    return search_guideline_chunks(query, limit, collection_name)

@app.post("/api/analysis/start")
async def start_analysis(
    run_type: str = Form(...), # 'quality', 'traceability', 'combined'
    guideline_id: str = Form(None),
    use_rag: str = Form("false"),
    model_name: str = Form("nvidia/llama-3.3-nemotron-super-49b-v1.5"),
    swe1_file: UploadFile = File(None),
    swe2_file: UploadFile = File(None),
    correct_quality: str = Form("false"),
    correct_trace: str = Form("false")
):
    """Spawns an async row-by-row requirements analysis or traceability evaluation run."""
    run_id = str(uuid.uuid4())
    
    swe1_content = await swe1_file.read() if swe1_file else None
    swe1_filename = swe1_file.filename if swe1_file else None
    
    swe2_content = await swe2_file.read() if swe2_file else None
    swe2_filename = swe2_file.filename if swe2_file else None
    
    use_rag_bool = use_rag.lower() == "true"
    correct_quality_bool = correct_quality.lower() == "true"
    correct_trace_bool = correct_trace.lower() == "true"
    
    # Run the job in the background
    asyncio.create_task(
        run_requirements_analysis_job(
            run_id=run_id,
            run_type=run_type,
            swe1_content=swe1_content,
            swe1_filename=swe1_filename,
            swe2_content=swe2_content,
            swe2_filename=swe2_filename,
            guideline_id=guideline_id,
            use_rag=use_rag_bool,
            model_name=model_name,
            correct_quality=correct_quality_bool,
            correct_trace=correct_trace_bool
        )
    )
    
    return {"status": "started", "run_id": run_id}

@app.post("/api/analysis/{run_id}/pause")
async def pause_analysis(run_id: str):
    if run_id in ACTIVE_JOBS:
        ACTIVE_JOBS[run_id]["status"] = "paused"
        update_execution_status(run_id, "paused")
        return {"status": "paused", "run_id": run_id}
    raise HTTPException(status_code=404, detail="Execution run not found or inactive")

@app.post("/api/analysis/{run_id}/resume")
async def resume_analysis(run_id: str):
    if run_id in ACTIVE_JOBS:
        ACTIVE_JOBS[run_id]["status"] = "running"
        update_execution_status(run_id, "running")
        return {"status": "running", "run_id": run_id}
    raise HTTPException(status_code=404, detail="Execution run not found or inactive")

@app.post("/api/analysis/{run_id}/stop")
async def stop_analysis(run_id: str):
    if run_id in ACTIVE_JOBS:
        ACTIVE_JOBS[run_id]["status"] = "stopped"
        update_execution_status(run_id, "stopped")
        return {"status": "stopped", "run_id": run_id}
    raise HTTPException(status_code=404, detail="Execution run not found or inactive")

@app.get("/api/analysis/{run_id}/status")
async def get_analysis_status(run_id: str):
    """Gets running/active progress details of a job."""
    if run_id in ACTIVE_JOBS:
        return ACTIVE_JOBS[run_id]
    return {"status": "inactive"}

@app.get("/api/analysis/{run_id}/results")
async def get_run_results(run_id: str):
    """Retrieves all parsed requirements and analysis row results for the run."""
    return get_execution_results(run_id)

@app.get("/api/analysis/history")
async def get_history(limit: int = 15):
    """Lists previous execution summaries, supporting the dashboard metrics and minimizations."""
    return get_previous_executions(limit)

@app.post("/api/analysis/{run_id}/minimize")
async def minimize_run(run_id: str, minimized: bool = Form(...)):
    """Minimizes/restores a run card on the frontend history section."""
    val = 1 if minimized else 0
    update_execution_minimized(run_id, val)
    return {"status": "success", "run_id": run_id, "minimized": minimized}

@app.delete("/api/analysis/{run_id}")
async def delete_run(run_id: str):
    """Deletes an execution run history and its results from the database."""
    delete_execution_run(run_id)
    return {"status": "success", "run_id": run_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
