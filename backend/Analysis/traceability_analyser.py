import json
from typing import List, Dict, Any
from Model.requirement import Requirement
from Analysis.quality_analyser import clean_and_parse_json

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
            
    # Robust deduplication by s2.name explicitly instead of identity-based set()
    seen = set()
    deduped = []
    for s2 in links:
        if s2.name not in seen:
            seen.add(s2.name)
            deduped.append(s2)
    return deduped

def analyze_traceability_from_swe1_with_llm(r_swe1: Requirement, swe2_reqs: list, llm) -> dict:
    """Calls Nvidia NIM API to analyze which SWE.2 requirements trace to a given SWE.1 requirement."""
    if not llm or not llm.client.api_key or llm.client.api_key == "mock-key":
        return {"status": "FAIL", "linked_swe2_ids": [], "rationale": "No LLM API key configured for semantic search."}

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
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        response = llm.get_response(messages, stream=False, model=getattr(llm, "analysis_model_name", "nvidia/llama-3.3-nemotron-super-49b-v1.5"))
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

def compare_traceability(swe1_reqs: List[Requirement], swe2_reqs: List[Requirement], llm=None) -> Dict[str, Any]:
    """
    Build bidirectional mapping links between SWE.1 (HLD) and SWE.2 (LLD) using AI.
    """
    metrics = {
        "total_hld": len(swe1_reqs),
        "covered_count": 0,
        "orphaned_count": 0,
        "coverage_pct": 0
    }
    table = []

    covered_swe2 = set()
    covered_swe1 = set()

    for r1 in swe1_reqs:
        # 1. Deterministic match first
        links = find_deterministic_links(r1, swe2_reqs)
        
        if links:
            covered_swe1.add(r1.name)
            for s2 in links:
                covered_swe2.add(s2.name)
                
            table.append({
                "swe1_id": r1.name,
                "swe1_content": r1.content,
                "swe2_id": ", ".join([s2.name for s2 in links]),
                "swe2_content": "\n".join([f"• {s2.name}: {s2.content}" for s2 in links]),
                "status": "PASS",
                "rationale": f"Matched {len(links)} SWE.2 requirement(s) deterministically."
            })
        else:
            # 2. Call LLM for semantic links if available
            result = analyze_traceability_from_swe1_with_llm(r1, swe2_reqs, llm)
            status = result.get("status", "FAIL")
            rationale = result.get("rationale", "No explanation provided.")
            linked_ids = result.get("linked_swe2_ids", [])
            linked_swe2s = [s2 for s2 in swe2_reqs if s2.name in linked_ids]
            
            if linked_swe2s:
                covered_swe1.add(r1.name)
                for s2 in linked_swe2s:
                    covered_swe2.add(s2.name)
                    
                table.append({
                    "swe1_id": r1.name,
                    "swe1_content": r1.content,
                    "swe2_id": ", ".join([s2.name for s2 in linked_swe2s]),
                    "swe2_content": "\n".join([f"• {s2.name}: {s2.content}" for s2 in linked_swe2s]),
                    "status": status,
                    "rationale": rationale
                })
            else:
                table.append({
                    "swe1_id": r1.name,
                    "swe1_content": r1.content,
                    "swe2_id": "-",
                    "swe2_content": "-",
                    "status": "FAIL",
                    "rationale": rationale
                })

    # Process orphaned SWE.2 requirements
    for s2 in swe2_reqs:
        if s2.name not in covered_swe2:
            table.append({
                "swe1_id": "-",
                "swe1_content": "-",
                "swe2_id": s2.name,
                "swe2_content": s2.content,
                "status": "FAIL",
                "rationale": "Orphaned LLD: No linked SWE.1 requirement found."
            })

    metrics["covered_count"] = len(covered_swe1)
    metrics["orphaned_count"] = metrics["total_hld"] - metrics["covered_count"]
    if metrics["total_hld"] > 0:
        metrics["coverage_pct"] = round((metrics["covered_count"] / metrics["total_hld"]) * 100, 2)

    return {
        "metrics": metrics,
        "table": table
    }
