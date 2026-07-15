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
    create_placeholder_result,
    update_execution_result_by_id,
    get_guideline_content,
    get_guideline_details,
    update_execution_progress,
    get_execution_run,
    get_execution_status
)
from backend.rag_service import rag_engine
from Analysis.traceability_analyser import find_deterministic_links, analyze_traceability_from_swe1_with_llm

# Active execution state tracker for single process fallback (still kept for backward compatibility, but DB is source of truth)
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

            # 2. Parse sheet target from workbook.xml and workbook.xml.rels
            sheet_target = 'worksheets/sheet1.xml' # default fallback
            namelist = zip_ref.namelist()
            if 'xl/workbook.xml' in namelist and 'xl/_rels/workbook.xml.rels' in namelist:
                try:
                    wb_content = zip_ref.read('xl/workbook.xml')
                    wb_root = ET.fromstring(wb_content)
                    ns_wb = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                    sheets_el = wb_root.find('ns:sheets', ns_wb)
                    if sheets_el is not None:
                        sheet_el = sheets_el.find('ns:sheet', ns_wb)
                        if sheet_el is not None:
                            # Use relationship ID to find target filename
                            r_id = sheet_el.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                            if r_id:
                                rels_content = zip_ref.read('xl/_rels/workbook.xml.rels')
                                rels_root = ET.fromstring(rels_content)
                                ns_rels = {'ns': 'http://schemas.openxmlformats.org/package/2006/relationships'}
                                for rel in rels_root.findall('ns:Relationship', ns_rels):
                                    if rel.get('Id') == r_id:
                                        sheet_target = rel.get('Target')
                                        break
                except Exception as e:
                    print(f"Error parsing workbook sheets, falling back to worksheets/sheet1.xml: {e}")

            sheet_path = 'xl/' + sheet_target
            if sheet_path not in namelist:
                sheet_path = 'xl/worksheets/sheet1.xml'

            sheet_content = zip_ref.read(sheet_path)
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
        try:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
            
    return rows

def parse_requirements_file(file_content: bytes, filename: str) -> list:
    if filename.endswith(".csv"):
        return read_csv_file(file_content)
    elif filename.endswith(".xlsx"):
        return read_xlsx_file(file_content)
    return []

def find_deterministic_links(swe1: Requirement, swe2_reqs: list) -> list:
    """Finds matching SWE.2 requirements for a given SWE.1 requirement based on explicit Mapped_SWE1_ID (covers) or ID reference in content."""
    links = []
    for r2 in swe2_reqs:
        # Check covers attribute
        if r2.covers:
            # Might be list like "SYS_REQ_0001, SYS_REQ_0002"
            covers_ids = [c.strip().lower() for c in r2.covers.split(",") if c.strip()]
            if swe1.name.lower() in covers_ids:
                links.append(r2)
                continue
        # Check text references like "SYS_REQ_0001" (case insensitive)
        if swe1.name.lower() in r2.content.lower():
            links.append(r2)
            continue
    return list(set(links)) # Deduplicate

def analyze_traceability_from_swe1_with_llm(r_swe1: Requirement, swe2_reqs: list, llm: LLMManager) -> dict:
    """Calls Nvidia NIM API to analyze which SWE.2 requirements trace to a given SWE.1 requirement."""
    # Build list of SWE.2 requirements for prompt context
    srs_list_str = "\n".join([f"- {srs.name}: {srs.content}" for srs in swe2_reqs[:100]]) # Limit to prevent context blowup
    
    system_prompt = (
        "You are an automotive safety and systems engineer. Evaluate which of the following Low-Level Software Requirements (SWE.2) "
        "properly trace to and satisfy the High-Level Requirement (SWE.1) listed below. "
        "Respond ONLY in a structured JSON format containing the following fields:\n"
        "{\n"
        '  "status": "PASS" | "FAIL" | "REVIEW",\n'
        '  "linked_swe2_ids": ["SWE2_0001", "SWE2_0002", ...] or [],\n'
        '  "rationale": "Reason why they trace or do not trace"\n'
        "}"
    )
    user_content = f"SWE.2 Requirements available:\n{srs_list_str}\n\nSWE.1 Requirement to match:\nID: {r_swe1.name}\nContent: {r_swe1.content}"
    
    try:
        if not llm or not llm.client.api_key or llm.client.api_key == "mock-key":
            return {"status": "FAIL", "linked_swe2_ids": [], "rationale": "No LLM API key configured for semantic search."}
            
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = llm.get_response(messages, stream=False, model=getattr(llm, "analysis_model_name", "nvidia/llama-3.3-nemotron-super-49b-v1.5"))
        from Analysis.quality_analyser import clean_and_parse_json
        res_data = clean_and_parse_json(response.choices[0].message.content)
        
        status_raw = res_data.get("status", "REVIEW").upper()
        linked_ids = res_data.get("linked_swe2_ids", [])
        if not isinstance(linked_ids, list):
            linked_ids = [linked_ids] if linked_ids else []
            
        return {
            "status": "PASS" if status_raw in ["PASS", "PASSED"] and len(linked_ids) > 0 else ("REVIEW" if status_raw == "REVIEW" else "FAIL"),
            "linked_swe2_ids": linked_ids,
            "rationale": res_data.get("rationale", "No rationale provided by LLM.")
        }
    except Exception as e:
        print(f"Nvidia NIM API traceability call failed: {e}")
        return {
            "status": "FAIL",
            "linked_swe2_ids": [],
            "rationale": f"LLM analysis failed: {str(e)}"
        }

def analyze_quality(
    idx: int,
    r: Requirement,
    llm: LLMManager,
    rag,
    rules_context: str,
    is_strict_json: bool,
    correct_quality: bool = False,
    custom_context: str = None,
    custom_context_correction: str = None
) -> dict:
    """Performs compliance check using POC auditor and performs automated rewrite correction if violation found and requested."""
    # 1. Run POC quality auditor
    _, res = analyze_single_requirement(
        index=idx,
        r=r,
        llm=llm,
        rag=rag,
        rag_context=rules_context,
        selected_collections="airam_guidelines",
        is_strict_json=is_strict_json,
        custom_context=custom_context
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
                selected_collections="airam_guidelines",
                feedback_rule=failed_rule_str,
                feedback_rationale=res.get("Rationale"),
                custom_context=custom_context_correction
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
    correct_trace: bool = False,
    custom_context: str = None,
    custom_context_correction: str = None
):
    """Executes the analysis process row-by-row supporting Pause, Resume, Stop operations."""
    print(f"[TRACE] Job {run_id} starting. type={run_type}", flush=True)
    try:
        guideline_name = None
        if guideline_id:
            from backend.database import get_guideline_details
            g_details = get_guideline_details(guideline_id)
            if g_details:
                guideline_name = g_details["name"]
                
        save_execution_run(run_id, run_type, "running", guideline_name=guideline_name)
        ACTIVE_JOBS[run_id] = {
            "status": "running",
            "current_row": 0,
            "total_rows": 0
        }
        
        # Initialize LLMManager using passed model
        llm_manager = LLMManager(model_name=model_name, analysis_model_name=model_name)
        print(f"[TRACE] LLM initialized. API key present: {llm_manager.client.api_key != 'mock-key'}", flush=True)
        
        # 1. Parse requirement sets
        swe1_reqs_raw = parse_requirements_file(swe1_content, swe1_filename) if swe1_content else []
        swe2_reqs_raw = parse_requirements_file(swe2_content, swe2_filename) if swe2_content else []
        print(f"[TRACE] Parsed SWE1: {len(swe1_reqs_raw)} rows, SWE2: {len(swe2_reqs_raw)} rows", flush=True)
        
        # Debug: print first parsed row keys to verify header mapping
        if swe1_reqs_raw:
            print(f"[TRACE] SWE1 first row keys: {list(swe1_reqs_raw[0].keys())}", flush=True)
            print(f"[TRACE] SWE1 first row id: {swe1_reqs_raw[0].get('id', 'MISSING')}", flush=True)
        if swe2_reqs_raw:
            print(f"[TRACE] SWE2 first row keys: {list(swe2_reqs_raw[0].keys())}", flush=True)
            print(f"[TRACE] SWE2 first row covers value: {swe2_reqs_raw[0].get('covers', swe2_reqs_raw[0].get('Covers', swe2_reqs_raw[0].get('Mapped_SWE1_ID', 'MISSING')))}", flush=True)
        
        # Convert lists to Requirement objects compatible with POC analyzer
        swe1_reqs = []
        for idx, item in enumerate(swe1_reqs_raw):
            swe1_reqs.append(Requirement(
                name=item.get("id", f"REQ-{idx+1}"),
                content=item.get("text", ""),
                state=item.get("state", item.get("State", "")),
                asil=item.get("asil", item.get("ASIL", "")),
                rationale=item.get("rationale", item.get("Rationale", "")),
                covers=item.get("covers", item.get("Mapped_SWE1_ID", item.get("mapped_swe1_id", "")))
            ))
            swe1_reqs[-1].category = "sys1"
            
        swe2_reqs = []
        for idx, item in enumerate(swe2_reqs_raw):
            swe2_reqs.append(Requirement(
                name=item.get("id", f"REQ-{idx+1}"),
                content=item.get("text", ""),
                state=item.get("state", item.get("State", "")),
                asil=item.get("asil", item.get("ASIL", "")),
                rationale=item.get("rationale", item.get("Rationale", "")),
                covers=item.get("covers", item.get("Covers", item.get("Mapped_SWE1_ID", item.get("mapped_swe1_id", ""))))
            ))
            swe2_reqs[-1].category = "sys2"
        
        print(f"[TRACE] Built {len(swe1_reqs)} SWE1 Requirement objects, {len(swe2_reqs)} SWE2 Requirement objects", flush=True)
        if swe2_reqs:
            print(f"[TRACE] SWE2[0] name={swe2_reqs[0].name}, covers='{swe2_reqs[0].covers}'", flush=True)
        
        # Determine what we are analyzing
        analysis_items = []
        mode = "quality"
        
        if run_type == "traceability":
            analysis_items = swe1_reqs
            mode = "traceability"
        else:
            # For quality or combined analysis, process all requirements
            analysis_items = swe1_reqs + swe2_reqs
            mode = "quality"
            
        total_rows = len(analysis_items)
        print(f"[TRACE] Mode={mode}, total_rows={total_rows}", flush=True)
        
        if run_id in ACTIVE_JOBS:
            ACTIVE_JOBS[run_id]["total_rows"] = total_rows
        update_execution_progress(run_id, current_row=0, total_rows=total_rows, status="running")
        
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
        covered_swe2_ids = set()
        for idx, r in enumerate(analysis_items):
            print(f"[TRACE] Processing row {idx+1}/{total_rows}: {r.name}", flush=True)
            
            # Handle Pause/Stop operations
            while True:
                status_db = get_execution_status(run_id) or "stopped"
                if run_id in ACTIVE_JOBS:
                    ACTIVE_JOBS[run_id]["status"] = status_db
                
                if status_db == "stopped":
                    update_execution_status(run_id, "stopped")
                    qa_mod.CURRENT_RULES = None
                    print(f"[TRACE] Job {run_id} stopped by user at row {idx+1}", flush=True)
                    return
                if status_db == "paused":
                    await asyncio.sleep(0.5)
                    continue
                break
                
            if run_id in ACTIVE_JOBS:
                ACTIVE_JOBS[run_id]["current_row"] = idx + 1
            update_execution_progress(run_id, current_row=idx + 1, total_rows=total_rows)
            
            # Determine initial placeholder keys
            if mode == "traceability":
                row_id = create_placeholder_result(run_id, None, None, category="traceability")
                update_execution_result_by_id(
                    row_id=row_id,
                    status="PROCESSING",
                    failed_rule=None,
                    rationale=f"Analyzing trace for {r.name}... waiting for LLM/deterministic response",
                    corrected_req=None,
                    swe1_id=r.name,
                    swe1_text=r.content,
                    category="traceability"
                )
            else:
                row_id = create_placeholder_result(run_id, r.name, r.content, category=getattr(r, "category", None))
                
            # Update progress bar state
            if run_id in ACTIVE_JOBS:
                ACTIVE_JOBS[run_id]["current_row"] = idx + 1
            update_execution_progress(run_id, current_row=idx + 1, total_rows=total_rows)
            
            # Resolve rules context: fetch from RAG similarity search if enabled
            rules_context = ""
            if use_rag and r.content:
                try:
                    # Query RAGEngine
                    rules_context = rag_engine.query(r.content, collection_name="airam_guidelines", top_k=2)
                except Exception as e:
                    print(f"RAG rules search failed: {e}")
                    
            # Analyze using LLM or local fallbacks based on mode
            if mode == "traceability":
                # 1. Deterministic Check
                deterministic_links = find_deterministic_links(r, swe2_reqs)
                print(f"[TRACE]   Deterministic links found: {len(deterministic_links)} for {r.name}", flush=True)
                if deterministic_links:
                    status = "PASS"
                    linked_swe2s = deterministic_links
                    rationale = f"Matched {len(deterministic_links)} SWE.2 requirement(s) deterministically (Mapped_SWE1_ID or direct ID text reference)."
                else:
                    # 2. LLM Semantic Check
                    print(f"[TRACE]   Falling back to LLM for {r.name}...", flush=True)
                    result = await asyncio.to_thread(analyze_traceability_from_swe1_with_llm, r, swe2_reqs, llm_manager)
                    print(f"[TRACE]   LLM returned: status={result.get('status')}, linked_ids={result.get('linked_swe2_ids', [])}", flush=True)
                    status = result.get("status", "FAIL")
                    rationale = result.get("rationale", "No explanation provided.")
                    linked_ids = result.get("linked_swe2_ids", [])
                    linked_swe2s = [s2 for s2 in swe2_reqs if s2.name in linked_ids]
                
                # Format outputs
                swe2_ids_str = ", ".join([s2.name for s2 in linked_swe2s]) if linked_swe2s else None
                swe2_texts_str = "\n".join([f"• {s2.name}: {s2.content}" for s2 in linked_swe2s]) if linked_swe2s else None
                
                # Track covered
                for s2 in linked_swe2s:
                    covered_swe2_ids.add(s2.name)
                    
                update_execution_result_by_id(
                    row_id=row_id,
                    status=status,
                    failed_rule=None,
                    rationale=rationale,
                    corrected_req=None,
                    swe1_id=r.name,
                    swe1_text=r.content,
                    req_id=swe2_ids_str,
                    input_req=swe2_texts_str
                )
            else:
                # Call quality auditor
                result = await asyncio.to_thread(analyze_quality, idx, r, llm_manager, rag_engine, rules_context, is_strict_json, correct_quality, custom_context, custom_context_correction)
                status = result.get("status", "REVIEW").upper()
                failed_rule = result.get("failed_rule")
                rationale = result.get("rationale", "No explanation provided.")
                corrected_req = result.get("corrected_req", r.content)
                
                update_execution_result_by_id(
                    row_id=row_id,
                    status=status,
                    failed_rule=failed_rule,
                    rationale=rationale,
                    corrected_req=corrected_req,
                    swe1_id=None,
                    swe1_text=None
                )
                
            print(f"[TRACE]   Row {idx+1} done: status={status}", flush=True)
            # Yield execution control to remain responsive
            await asyncio.sleep(0.01)
            
        if mode == "traceability":
            # Process orphaned SWE.2 requirements
            orphan_count = 0
            for s2 in swe2_reqs:
                if s2.name not in covered_swe2_ids:
                    orphan_count += 1
                    row_id = create_placeholder_result(run_id, s2.name, s2.content, category="traceability")
                    update_execution_result_by_id(
                        row_id=row_id,
                        status="FAIL",
                        failed_rule="Orphan LLD",
                        rationale="Orphaned LLD: No linked SWE.1 requirement found.",
                        corrected_req=None,
                        swe1_id=None,
                        swe1_text=None,
                        category="traceability"
                    )
            print(f"[TRACE] Orphaned SWE.2 requirements: {orphan_count}", flush=True)
                    
        update_execution_progress(run_id, current_row=total_rows, total_rows=total_rows, status="completed")
        if run_id in ACTIVE_JOBS:
            ACTIVE_JOBS[run_id]["status"] = "completed"
            ACTIVE_JOBS[run_id]["current_row"] = total_rows
        # Reset rules state
        qa_mod.CURRENT_RULES = None
        print(f"[TRACE] Job {run_id} COMPLETED successfully.", flush=True)
    except Exception as e:
        import traceback
        print(f"[ERROR] Job {run_id} CRASHED: {e}", flush=True)
        traceback.print_exc()
        # Mark the job as stopped in DB so frontend stops polling
        try:
            update_execution_progress(run_id, current_row=0, total_rows=0, status="stopped")
        except Exception:
            pass
        if run_id in ACTIVE_JOBS:
            ACTIVE_JOBS[run_id]["status"] = "stopped"
        qa_mod.CURRENT_RULES = None

