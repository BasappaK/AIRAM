import os
import sys

# Ensure parent directory is in python path for absolute imports if executed directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import csv
import json
import uuid
import time
import zipfile
import asyncio
import xml.etree.ElementTree as ET
from openai import OpenAI
from backend.database import (
    save_execution_run,
    update_execution_status,
    save_execution_result,
    get_guideline_content
)
from backend.rag_service import search_guideline_chunks

# Environment variables
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
nv_client = None
if NVIDIA_API_KEY:
    nv_client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=NVIDIA_API_KEY
    )

# Active execution state tracker
ACTIVE_JOBS = {}  # run_id -> { "status": "running" | "paused" | "stopped", "current_row": int, "total_rows": int }

def read_csv_file(file_content: bytes) -> list:
    """Parses csv bytes into list of dictionaries."""
    text = file_content.decode("utf-8", errors="ignore").splitlines()
    reader = csv.DictReader(text)
    # Normalize headers
    rows = []
    for row in reader:
        normalized_row = {}
        for k, v in row.items():
            if not k:
                continue
            k_lower = k.lower().strip()
            if "id" in k_lower:
                normalized_row["id"] = v.strip()
            elif "req" in k_lower or "text" in k_lower or "desc" in k_lower:
                normalized_row["text"] = v.strip()
            else:
                normalized_row[k] = v.strip()
        
        # Ensure we have id and text
        if "id" not in normalized_row:
            normalized_row["id"] = f"REQ-{len(rows)+1}"
        if "text" not in normalized_row and len(row) > 0:
            # Fallback to the first non-id column
            for col_val in row.values():
                if col_val != normalized_row.get("id"):
                    normalized_row["text"] = col_val
                    break
        
        if "text" in normalized_row:
            rows.append(normalized_row)
    return rows

def read_xlsx_file(file_content: bytes) -> list:
    """Parses .xlsx sheet rows using Python standard libraries (zipfile & xml) to avoid external dependencies."""
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name
        
    rows = []
    try:
        with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
            # 1. Parse shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in zip_ref.namelist():
                ss_content = zip_ref.read('xl/sharedStrings.xml')
                root = ET.fromstring(ss_content)
                # Namespace mapping
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('ns:si', ns):
                    t = si.find('ns:t', ns)
                    if t is not None:
                        shared_strings.append(t.text)
                    else:
                        # Rich text handling
                        text_parts = [r.find('ns:t', ns).text for r in si.findall('ns:r', ns) if r.find('ns:t', ns) is not None]
                        shared_strings.append("".join(text_parts))

            # 2. Parse sheet1
            sheet_content = zip_ref.read('xl/worksheets/sheet1.xml')
            root = ET.fromstring(sheet_content)
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            raw_rows = []
            for row_el in root.findall('.//ns:row', ns):
                row_cells = {}
                for c in row_el.findall('ns:c', ns):
                    r_attr = c.get('r') # e.g. A1, B2
                    col_letter = ''.join([char for char in r_attr if char.isalpha()])
                    t_attr = c.get('t') # e.g. 's' for shared string
                    v = c.find('ns:v', ns)
                    val = ""
                    if v is not None:
                        val = v.text
                        if t_attr == 's':
                            val = shared_strings[int(val)]
                    row_cells[col_letter] = val
                raw_rows.append(row_cells)
                
            if raw_rows:
                # Use first row as headers
                header_row = raw_rows[0]
                headers = {col: val.lower().strip() for col, val in header_row.items() if val}
                
                for r in raw_rows[1:]:
                    normalized_row = {}
                    for col, val in r.items():
                        if col not in headers:
                            continue
                        h_name = headers[col]
                        if "id" in h_name:
                            normalized_row["id"] = val
                        elif "req" in h_name or "text" in h_name or "desc" in h_name:
                            normalized_row["text"] = val
                        else:
                            normalized_row[h_name] = val
                    
                    if "id" not in normalized_row:
                        normalized_row["id"] = f"REQ-{len(rows)+1}"
                    if "text" not in normalized_row:
                        # Fallback to first available value
                        for val in r.values():
                            if val != normalized_row.get("id"):
                                normalized_row["text"] = val
                                break
                                
                    if "text" in normalized_row:
                        rows.append(normalized_row)
    finally:
        os.remove(tmp_path)
        
    return rows

def parse_requirements_file(file_content: bytes, filename: str) -> list:
    if filename.endswith(".csv"):
        return read_csv_file(file_content)
    elif filename.endswith(".xlsx"):
        return read_xlsx_file(file_content)
    return []

def evaluate_requirement_heuristics(req_text: str, rules_context: str = "") -> dict:
    """Fallback local analyzer for INCOSE and ASPICE guidelines using simple heuristics."""
    req_lower = req_text.lower()
    
    # Heuristic 1: Missing modal verbs (shall, should, will)
    if "shall" not in req_lower and "should" not in req_lower and "will" not in req_lower:
        return {
            "status": "FAIL",
            "failed_rule": "INCOSE-RL-01 (Modal Verbs)",
            "rationale": "Requirement does not contain any of the mandatory modal verbs ('shall', 'should', 'must').",
            "corrected_req": f"The system shall {req_text[0].lower() + req_text[1:] if len(req_text) > 1 else req_text}"
        }
        
    # Heuristic 2: Vagueness (fast, cheap, clean, user-friendly, robust)
    vague_words = ["fast", "cheap", "clean", "user-friendly", "robust", "efficient", "appropriate"]
    for w in vague_words:
        if w in req_lower:
            return {
                "status": "REVIEW",
                "failed_rule": "INCOSE-RL-02 (Vagueness)",
                "rationale": f"Requirement contains vague/non-verifiable word '{w}'. Quantify the requirement parameters.",
                "corrected_req": req_text.replace(w, f"{w} (specify quantified metric)")
            }
            
    # Heuristic 3: Multiple requirements combined (and, also, as well as)
    if " and " in req_lower and len(req_text) > 120:
        return {
            "status": "REVIEW",
            "failed_rule": "INCOSE-RL-03 (Singularity)",
            "rationale": "Requirement contains 'and' in a long sentence, suggesting multiple requirements are combined.",
            "corrected_req": req_text.split(" and ")[0] + "."
        }
        
    return {
        "status": "PASS",
        "failed_rule": None,
        "rationale": "Requirement follows base grammar, contains modal verb, and has no vagueness.",
        "corrected_req": req_text
    }

async def analyze_with_llm(req_text: str, rules_context: str, model_name: str, mode: str, swe1_requirements: list = None) -> dict:
    """Calls Nvidia NIM API to analyze requirements or fallback to heuristics if not configured."""
    if not nv_client:
        # Traceability mock simulation
        if mode == "traceability" and swe1_requirements:
            # Let's see if we can find a matching HLR ID
            # If the requirement text contains or references a similar keyword, map it.
            matched_id = None
            for hlr in swe1_requirements:
                hlr_words = set(hlr["text"].lower().split())
                llr_words = set(req_text.lower().split())
                common = hlr_words.intersection(llr_words)
                if len(common) > 2: # heuristic keyword overlap
                    matched_id = hlr["id"]
                    break
            
            if matched_id:
                return {
                    "status": "PASS",
                    "swe1_id": matched_id,
                    "rationale": f"Traces successfully to High Level Requirement {matched_id} due to keyword match.",
                    "corrected_req": req_text
                }
            else:
                return {
                    "status": "FAIL",
                    "swe1_id": None,
                    "rationale": "No tracing high-level requirement (SWE.1) found matching this detailed low-level requirement (SWE.2).",
                    "corrected_req": req_text + " [Traced to: HLR-XXX]"
                }
                
        return evaluate_requirement_heuristics(req_text, rules_context)

    # Prepare LLM prompts
    if mode == "traceability" and swe1_requirements:
        hlr_list_str = "\n".join([f"- {hlr['id']}: {hlr['text']}" for hlr in swe1_requirements[:50]]) # Limit to prevent context blowup
        system_prompt = (
            "You are an automotive safety and systems engineer. Evaluate if the following Low-Level Software Requirement (SWE.2) "
            "properly traces to and satisfies one of the High-Level Requirements (SWE.1) listed below. "
            "Respond ONLY in a structured JSON format containing the following fields:\n"
            "{\n"
            '  "status": "PASS" | "FAIL" | "REVIEW",\n'
            '  "swe1_id": "The matching SWE.1 ID (e.g. REQ-1) or null if none match",\n'
            '  "rationale": "Reason why it traces or does not trace",\n'
            '  "corrected_req": "Proposed rewrite of SWE.2 if trace correction is needed, or the original req if fine"\n'
            "}"
        )
        user_content = f"SWE.1 Requirements:\n{hlr_list_str}\n\nSWE.2 Requirement:\n{req_text}"
    else:
        system_prompt = (
            "You are an expert automotive systems validator. Analyze the input requirement against the INCOSE/ASPICE guidelines "
            "provided in the context. Determine if it passes, fails, or needs review. "
            "Respond ONLY in a structured JSON format containing the following fields:\n"
            "{\n"
            '  "status": "PASS" | "FAIL" | "REVIEW",\n'
            '  "failed_rule": "The name or ID of the guideline rule violated (or null)",\n'
            '  "rationale": "Detailed explanation of why it failed or passed",\n'
            '  "corrected_req": "Proposed correction of the requirement violating the guidelines"\n'
            "}"
        )
        user_content = f"Guidelines Context:\n{rules_context}\n\nRequirement:\n{req_text}"

    try:
        # Call Nvidia NIM
        completion = nv_client.chat.completions.create(
            model=model_name or "meta/llama-3.1-70b-instruct",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        res_text = completion.choices[0].message.content
        return json.loads(res_text)
    except Exception as e:
        print(f"Nvidia NIM API call failed: {e}")
        return evaluate_requirement_heuristics(req_text, rules_context)

async def run_requirements_analysis_job(
    run_id: str,
    run_type: str, # 'quality', 'traceability', 'combined'
    swe1_content: bytes = None,
    swe1_filename: str = None,
    swe2_content: bytes = None,
    swe2_filename: str = None,
    guideline_id: str = None,
    use_rag: bool = False,
    model_name: str = "meta/llama-3.1-70b-instruct"
):
    """Executes the analysis process row-by-row supporting Pause, Resume, Stop operations."""
    save_execution_run(run_id, run_type, "running")
    ACTIVE_JOBS[run_id] = {
        "status": "running",
        "current_row": 0,
        "total_rows": 0
    }
    
    # 1. Parse requirement sets
    swe1_reqs = parse_requirements_file(swe1_content, swe1_filename) if swe1_content else []
    swe2_reqs = parse_requirements_file(swe2_content, swe2_filename) if swe2_content else []
    
    # Determine what we are analyzing
    # If traceability: swe2_reqs is analyzed, mapped against swe1_reqs
    # If quality/correction: we analyze whatever is uploaded (swe1 if only swe1, swe2 if only swe2, or both)
    analysis_items = []
    mode = "quality"
    
    if run_type == "traceability":
        analysis_items = swe2_reqs
        mode = "traceability"
    else:
        analysis_items = swe1_reqs + swe2_reqs
        mode = "quality"
        
    total_rows = len(analysis_items)
    ACTIVE_JOBS[run_id]["total_rows"] = total_rows
    
    # 2. Get rules context if strict guidelines file upload is selected
    strict_guidelines_content = ""
    if guideline_id and not use_rag:
        try:
            content_json = get_guideline_content(guideline_id)
            if content_json:
                strict_guidelines_content = json.dumps(content_json, indent=2)
        except Exception as e:
            print(f"Failed to read guidelines {guideline_id}: {e}")
            
    # Loop and analyze row-by-row
    for idx, item in enumerate(analysis_items):
        # Handle Pause/Stop operations
        while True:
            job_state = ACTIVE_JOBS.get(run_id)
            if not job_state or job_state["status"] == "stopped":
                update_execution_status(run_id, "stopped")
                return
            if job_state["status"] == "paused":
                await asyncio.sleep(0.5)
                continue
            break
            
        ACTIVE_JOBS[run_id]["current_row"] = idx + 1
        
        req_id = item.get("id", f"REQ-{idx+1}")
        req_text = item.get("text", "")
        
        # Resolve rules context: either fetch from RAG similarity search, or use the strict guidelines context
        rules_context = strict_guidelines_content
        if use_rag and req_text:
            try:
                chunks = search_guideline_chunks(req_text, limit=3)
                rules_context = "\n\n".join([c["text"] for c in chunks])
            except Exception as e:
                print(f"RAG rules search failed: {e}")
                
        # Analyze using LLM or local fallbacks
        result = await analyze_with_llm(
            req_text=req_text,
            rules_context=rules_context,
            model_name=model_name,
            mode=mode,
            swe1_requirements=swe1_reqs
        )
        
        # Save results immediately
        status = result.get("status", "REVIEW").upper()
        failed_rule = result.get("failed_rule") or result.get("swe1_id") if mode == "traceability" else result.get("failed_rule")
        rationale = result.get("rationale", "No explanation provided.")
        corrected_req = result.get("corrected_req", req_text)
        swe1_id = result.get("swe1_id") if mode == "traceability" else None
        
        save_execution_result(
            run_id=run_id,
            req_id=req_id,
            input_req=req_text,
            status=status,
            failed_rule=failed_rule,
            rationale=rationale,
            corrected_req=corrected_req,
            swe1_id=swe1_id
        )
        
        # Yield status via print/log or we'll wrap this in a stream generator in main.py
        await asyncio.sleep(0.1) # Yield execution control
        
    update_execution_status(run_id, "completed")
    ACTIVE_JOBS[run_id]["status"] = "completed"
