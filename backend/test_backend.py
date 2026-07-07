import os
import sys
import io
import json
import asyncio

# Configure python path for imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(backend_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from backend.database import init_db, get_chunking_metrics
from backend.rag_service import train_document_stream, search_guideline_chunks
from backend.analyzer_service import run_requirements_analysis_job, ACTIVE_JOBS

async def run_tests():
    print("=== STARTING BACKEND INTEGRATION TESTS ===")
    
    # 1. Initialize DB
    print("\n[Test 1] Initializing SQLite database...")
    init_db()
    print("Database initialized successfully.")
    
    # 2. Test RAG progressive chunking
    print("\n[Test 2] Testing progressive RAG training stream...")
    test_json_rules = {
        "rules": [
            {"id": "INCOSE-1", "rule": "The requirement must contain a modal verb (shall/should/will)."},
            {"id": "INCOSE-2", "rule": "The requirement must be singular, concise, and non-vague."}
        ]
    }
    file_bytes = json.dumps(test_json_rules, indent=2).encode("utf-8")
    filename = "test_rules.json"
    
    states = []
    for state in train_document_stream(file_bytes, filename):
        states.append(state)
        print(f"  Streaming: Status = {state['status']}, Chunks processed = {state.get('processed', 0)}")
        
    assert len(states) >= 2, "Should yield at least start and completed states"
    assert states[-1]["status"] == "completed", "Final status should be completed"
    print("RAG Training Stream completed successfully.")
    
    # 3. Test RAG search bar manual evaluation
    print("\n[Test 3] Testing similarity search retrieval...")
    metrics = get_chunking_metrics()
    print(f"Current RAG Metrics: {metrics}")
    
    query = "modal verb"
    search_hits = search_guideline_chunks(query, limit=2)
    print(f"Search query: '{query}'")
    for idx, hit in enumerate(search_hits):
        print(f"  Hit {idx+1}: score={hit['score']:.3f}, text={hit['text'][:60]}...")
    assert len(search_hits) > 0, "Should retrieve relevant guideline chunks"
    
    # 4. Test SWE.1 and SWE.2 requirement parsing and traceability analysis
    print("\n[Test 4] Testing requirements quality & traceability analysis...")
    
    # Mock HLR (SWE.1) CSV content
    hlr_csv = "id,text\nHLR-1,The powertrain system shall deliver 150kW peak power.\nHLR-2,The battery cooling system shall active control temperature.\n"
    # Mock LLR (SWE.2) CSV content
    llr_csv = "id,text\nLLR-1,The MCU software shall monitor peak power to stay under 150kW.\nLLR-2,The driver seat adjustability should be robust.\n"
    
    run_id = "test-run-1234"
    run_type = "traceability"
    
    # Run the job in the background to simulate async behaviour
    job_task = asyncio.create_task(
        run_requirements_analysis_job(
            run_id=run_id,
            run_type=run_type,
            swe1_content=hlr_csv.encode("utf-8"),
            swe1_filename="swe1_reqs.csv",
            swe2_content=llr_csv.encode("utf-8"),
            swe2_filename="swe2_reqs.csv",
            guideline_id=None,
            use_rag=False,
            model_name="nvidia/llama-3.3-nemotron-super-49b-v1.5"
        )
    )
    
    # Wait for the job to start and verify running status
    await asyncio.sleep(0.05)
    assert run_id in ACTIVE_JOBS, "Job should be active"
    print(f"Job started: status = {ACTIVE_JOBS[run_id]['status']}, progress = {ACTIVE_JOBS[run_id]['current_row']}/{ACTIVE_JOBS[run_id]['total_rows']}")
    
    # Test Pause
    print("Pausing execution...")
    ACTIVE_JOBS[run_id]["status"] = "paused"
    await asyncio.sleep(0.2)
    print(f"Job state check: status = {ACTIVE_JOBS[run_id]['status']}")
    
    # Test Resume
    print("Resuming execution...")
    ACTIVE_JOBS[run_id]["status"] = "running"
    
    # Let it finish
    await job_task
    assert ACTIVE_JOBS[run_id]["status"] == "completed", "Job should run to completion"
    print("Job completed successfully.")
    
    from backend.database import get_execution_results
    results = get_execution_results(run_id)
    print("\nAnalysis Result Details:")
    for res in results:
        print(f"  Req ID: {res['req_id']}, Input: {res['input_req']}")
        print(f"    Status: {res['status']}, Rule: {res['failed_rule']}")
        print(f"    Rationale: {res['rationale']}")
        print(f"    Corrected: {res['corrected_req']}")
        
    print("\n=== ALL BACKEND INTEGRATION TESTS PASSED ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
