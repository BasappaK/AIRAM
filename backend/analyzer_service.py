import os
import sys
import csv
import json
import uuid
import time
import zipfile
import asyncio
import xml.etree.ElementTree as ET

from Model.llm import LLMManager
from Model.requirement import Requirement
from Analysis.quality_analyser import analyze_single_requirement, correct_single_requirement
import Analysis.quality_analyser as qa_mod
from backend.database import (
    save_execution_run,
    update_execution_status,
    save_execution_result,
    get_guideline_content,
    get_guideline_details
)
from backend.rag_service import rag_engine

# Active execution state tracker
ACTIVE_JOBS = {}  # run_id -> { "status": "running" | "paused" | "stopped", "current_row": int, "total_rows": int }

def find_best_header(headers: list, target_list: list) -> str:
    # Try to find exact matches first
    for target in target_list:
        for h in headers:
            if h.lower().strip() == target:
                return h
    # Substring matching, ignoring obvious incorrect overlap
    for target in target_list:
        for h in headers:
            h_lower = h.lower().strip()
            if target in h_lower:
                # Avoid matching 'fault id' for requirement 'id'
                if target == "id" and "fault" in h_lower:
                    continue
                return h
    return None

def read_csv_file(file_content: bytes) -> list:
    """Parses csv bytes into list of dictionaries with header safety mapping."""
    text = file_content.decode("utf-8", errors="ignore").splitlines()
    reader = csv.DictReader(text)
    headers = reader.fieldnames if reader.fieldnames else []
    
    # Clean headers
    headers = [h.strip() for h in headers if h]
    
    id_header = find_best_header(headers, ["id", "req_id", "requirement_id", "req id", "requirement id", "name"])
    text_header = find_best_header(headers, ["content", "requirement", "text", "description", "req_text", "req text", "requirement text", "desc"])
    
    # Fallbacks if not found
    if not id_header and headers:
        for h in headers:
            h_lower = h.lower()
            if "id" in h_lower and "fault" not in h_lower:
                id_header = h
                break
        if not id_header:
            id_header = headers[0]
            
    if not text_header and headers:
        for h in headers:
            h_lower = h.lower()
            if any(x in h_lower for x in ["req", "text", "content", "desc"]):
                text_header = h
                break
        if not text_header:
            for h in headers:
                if h != id_header:
                    text_header = h
                    break

    rows = []
    for row in reader:
        if not any(row.values()):
            continue
        req_id = row.get(id_header, "").strip() if id_header and row.get(id_header) else f"REQ-{len(rows)+1}"
        req_text = row.get(text_header, "").strip() if text_header and row.get(text_header) else ""
        
        normalized_row = {
            "id": req_id,
            "text": req_text
        }
        
        for k, v in row.items():
            if k and v:
                k_clean = k.strip()
                if k_clean != id_header and k_clean != text_header:
                    normalized_row[k_clean] = v.strip()
                    
        rows.append(normalized_row)
    return rows

def read_xlsx_file(file_content: bytes) -> list:
    """Parses .xlsx sheet rows using Python standard libraries (zipfile & xml) with header safety mapping."""
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
                headers = {col: val.strip() for col, val in header_row.items() if val}
                header_names = list(headers.values())
                
                id_header = find_best_header(header_names, ["id", "req_id", "requirement_id", "req id", "requirement id", "name"])
                text_header = find_best_header(header_names, ["content", "requirement", "text", "description", "req_text", "req text", "requirement text", "desc"])
                
                # Fallback mapping if not found
                if not id_header and header_names:
                    for h in header_names:
                        if "id" in h.lower() and "fault" not in h.lower():
                            id_header = h
                            break
                    if not id_header:
                        id_header = header_names[0]
                        
                if not text_header and header_names:
                    for h in header_names:
                        if any(x in h.lower() for x in ["req", "text", "content", "desc"]):
                            text_header = h
                            break
                    if not text_header:
                        for h in header_names:
                            if h != id_header:
                                text_header = h
                                break
                                
                # Map column letters to normalized key names
                col_mapping = {}
                for col, name in headers.items():
                    if name == id_header:
                        col_mapping[col] = "id"
                    elif name == text_header:
                        col_mapping[col] = "text"
                    else:
                        col_mapping[col] = name
                
                for r in raw_rows[1:]:
                    if not any(r.values()):
                        continue
                    normalized_row = {}
                    for col, val in r.items():
                        if col not in col_mapping:
                            continue
                        key = col_mapping[col]
                        normalized_row[key] = val.strip() if val else ""
                    
                    if "id" not in normalized_row or not normalized_row["id"]:
                        normalized_row["id"] = f"REQ-{len(rows)+1}"
                    if "text" not in normalized_row:
                        normalized_row["text"] = ""
                        
                    # Copy remaining metadata
                    for col, val in r.items():
                        if col in headers:
                            name = headers[col]
                            if name != id_header and name != text_header and val:
                                normalized_row[name] = val.strip()
                                
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

def evaluate_traceability_heuristics(req_text: str, swe1_reqs: list) -> dict:
    """Fallback local analyzer for requirement traceability based on keyword match heuristics."""
    matched_id = None
    for hlr in swe1_reqs:
        hlr_words = set(hlr.content.lower().split())
        llr_words = set(req_text.lower().split())
        common = hlr_words.intersection(llr_words)
        if len(common) > 2: # heuristic keyword overlap
            matched_id = hlr.name
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

def analyze_traceability_with_llm(r: Requirement, swe1_reqs: list, llm: LLMManager) -> dict:
    """Calls Nvidia NIM API to analyze requirements traceability between SWE.1 and SWE.2."""
    if not llm.client.api_key:
        return evaluate_traceability_heuristics(r.content, swe1_reqs)
        
    hlr_list_str = "\n".join([f"- {hlr.name}: {hlr.content}" for hlr in swe1_reqs[:50]]) # Limit to prevent context blowup
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
    user_content = f"SWE.1 Requirements:\n{hlr_list_str}\n\nSWE.2 Requirement:\n{r.content}"
    
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = llm.get_response(messages, stream=False, model=getattr(llm, "analysis_model_name", "nvidia/llama-3.3-nemotron-super-49b-v1.5"))
        from Analysis.quality_analyser import clean_and_parse_json
        res_data = clean_and_parse_json(response.choices[0].message.content)
        # Normalize status to uppercase matching DB constraint
        status_raw = res_data.get("status", "REVIEW").upper()
        return {
            "status": "PASS" if status_raw in ["PASS", "PASSED"] else ("REVIEW" if status_raw == "REVIEW" else "FAIL"),
            "swe1_id": res_data.get("swe1_id"),
            "rationale": res_data.get("rationale", "No rationale provided by LLM."),
            "corrected_req": res_data.get("corrected_req", r.content)
        }
    except Exception as e:
        print(f"Nvidia NIM API traceability call failed: {e}")
        return evaluate_traceability_heuristics(r.content, swe1_reqs)

def analyze_quality(
    idx: int,
    r: Requirement,
    llm: LLMManager,
    rag,
    rules_context: str,
    is_strict_json: bool,
    correct_quality: bool = False
) -> dict:
    """Performs compliance check using POC auditor and performs automated rewrite correction if violation found and requested."""
    # 1. Run POC quality auditor
    _, res = analyze_single_requirement(
        index=idx,
        r=r,
        llm=llm,
        rag=rag,
        rag_context=rules_context,
        selected_collections="aaram_guidelines",
        is_strict_json=is_strict_json
    )
    
    poc_status = res.get("Status", "Review")
    if poc_status.upper() in ["PASSED", "PASS"]:
        db_status = "PASS"
        corrected_req = r.content
    else:
        db_status = "REVIEW"
        if correct_quality:
            # Extract rule violation info to feed back into POC correction logic
            failed_rules_list = res.get("Failed Rules", [])
            failed_rule_str = ", ".join(failed_rules_list) if isinstance(failed_rules_list, list) else str(failed_rules_list)
            
            # 2. Run POC correction logic
            _, _, _, corrected_req, _ = correct_single_requirement(
                index=idx,
                r=r,
                llm=llm,
                rag=rag,
                rag_context=rules_context,
                selected_collections="aaram_guidelines",
                feedback_rule=failed_rule_str,
                feedback_rationale=res.get("Rationale")
            )
        else:
            corrected_req = None
        
    failed_rules_list = res.get("Failed Rules", [])
    failed_rule_str = ", ".join(failed_rules_list) if isinstance(failed_rules_list, list) else str(failed_rules_list)
    
    return {
        "status": db_status,
        "failed_rule": failed_rule_str if failed_rule_str and failed_rule_str != "None" else None,
        "rationale": res.get("Rationale", "No explanation provided."),
        "corrected_req": corrected_req,
        "swe1_id": None
    }

async def run_requirements_analysis_job(
    run_id: str,
    run_type: str, # 'quality', 'traceability', 'combined'
    swe1_content: bytes = None,
    swe1_filename: str = None,
    swe2_content: bytes = None,
    swe2_filename: str = None,
    guideline_id: str = None,
    use_rag: bool = False,
    model_name: str = "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    correct_quality: bool = False,
    correct_trace: bool = False
):
    """Executes the analysis process row-by-row supporting Pause, Resume, Stop operations."""
    save_execution_run(run_id, run_type, "running")
    ACTIVE_JOBS[run_id] = {
        "status": "running",
        "current_row": 0,
        "total_rows": 0
    }
    
    # Initialize LLMManager using passed model
    llm_manager = LLMManager(model_name=model_name, analysis_model_name=model_name)
    
    # 1. Parse requirement sets
    swe1_reqs_raw = parse_requirements_file(swe1_content, swe1_filename) if swe1_content else []
    swe2_reqs_raw = parse_requirements_file(swe2_content, swe2_filename) if swe2_content else []
    
    # Convert lists to Requirement objects compatible with POC analyzer
    swe1_reqs = []
    for idx, item in enumerate(swe1_reqs_raw):
        swe1_reqs.append(Requirement(
            name=item.get("id", f"REQ-{idx+1}"),
            content=item.get("text", ""),
            state=item.get("state", item.get("State", "")),
            asil=item.get("asil", item.get("ASIL", "")),
            rationale=item.get("rationale", item.get("Rationale", ""))
        ))
        
    swe2_reqs = []
    for idx, item in enumerate(swe2_reqs_raw):
        swe2_reqs.append(Requirement(
            name=item.get("id", f"REQ-{idx+1}"),
            content=item.get("text", ""),
            state=item.get("state", item.get("State", "")),
            asil=item.get("asil", item.get("ASIL", "")),
            rationale=item.get("rationale", item.get("Rationale", ""))
        ))
    
    # Determine what we are analyzing
    analysis_items = []
    mode = "quality"
    
    if run_type == "traceability":
        analysis_items = swe2_reqs
        mode = "traceability"
    else:
        # For quality or combined analysis, process all requirements
        analysis_items = swe1_reqs + swe2_reqs
        mode = "quality"
        
    total_rows = len(analysis_items)
    ACTIVE_JOBS[run_id]["total_rows"] = total_rows
    
    # 2. Inject strict guidelines content globally if strict guidelines mode is chosen
    is_strict_json = (guideline_id is not None and guideline_id.strip() != "" and not use_rag)
    if is_strict_json:
        try:
            ids = [i.strip() for i in guideline_id.split(",") if i.strip()]
            combined_rules = {}
            for gid in ids:
                g_details = get_guideline_details(gid)
                if g_details:
                    combined_rules[g_details["name"]] = g_details["content"]
            qa_mod.CURRENT_RULES = combined_rules
        except Exception as e:
            print(f"Failed to load strict guidelines {guideline_id}: {e}")
            qa_mod.CURRENT_RULES = None
    else:
        qa_mod.CURRENT_RULES = None
        
    # Loop and analyze row-by-row
    for idx, r in enumerate(analysis_items):
        # Handle Pause/Stop operations
        while True:
            job_state = ACTIVE_JOBS.get(run_id)
            if not job_state or job_state["status"] == "stopped":
                update_execution_status(run_id, "stopped")
                qa_mod.CURRENT_RULES = None
                return
            if job_state["status"] == "paused":
                await asyncio.sleep(0.5)
                continue
            break
            
        ACTIVE_JOBS[run_id]["current_row"] = idx + 1
        
        req_id = r.name
        req_text = r.content
        
        # Resolve rules context: fetch from RAG similarity search if enabled
        rules_context = ""
        if use_rag and req_text:
            try:
                # Query RAGEngine
                rules_context = rag_engine.query(req_text, collection_name="aaram_guidelines", top_k=2)
            except Exception as e:
                print(f"RAG rules search failed: {e}")
                
        # Analyze using LLM or local fallbacks based on mode
        if mode == "traceability":
            # Call traceability analyzer
            result = analyze_traceability_with_llm(r, swe1_reqs, llm_manager)
            if not correct_trace:
                result["corrected_req"] = None
        else:
            # Call quality auditor
            result = analyze_quality(idx, r, llm_manager, rag_engine, rules_context, is_strict_json, correct_quality)
            
        # Save results immediately
        status = result.get("status", "REVIEW").upper()
        failed_rule = result.get("failed_rule")
        rationale = result.get("rationale", "No explanation provided.")
        corrected_req = result.get("corrected_req", req_text)
        swe1_id = result.get("swe1_id")
        
        save_execution_result(
            run_id=run_id,
            req_id=req_id,
            input_req=req_text,
            status=status,
            failed_rule=failed_rule or swe1_id, # In traceability, failed_rule column can capture swe1_id or matching info
            rationale=rationale,
            corrected_req=corrected_req,
            swe1_id=swe1_id
        )
        
        # Yield execution control to remain responsive
        await asyncio.sleep(0.01)
        
    update_execution_status(run_id, "completed")
    ACTIVE_JOBS[run_id]["status"] = "completed"
    # Reset rules state
    qa_mod.CURRENT_RULES = None
