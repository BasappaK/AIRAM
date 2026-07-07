import os
import sqlite3
import json

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aaram.db")
OLD_DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "requalitrace.db")

# Automatically migrate database if old one exists
if not os.path.exists(DATABASE_PATH) and os.path.exists(OLD_DATABASE_PATH):
    try:
        import shutil
        shutil.copy2(OLD_DATABASE_PATH, DATABASE_PATH)
        print(f"[database] Migrated old database to {DATABASE_PATH}")
    except Exception as e:
        print(f"[database] Failed to migrate database: {e}")

def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Guidelines Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS guidelines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Chunks Table for progressive loading & metrics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_name TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            qdrant_id TEXT,
            embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Execution Runs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_runs (
            run_id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type TEXT NOT NULL, -- 'quality', 'traceability', 'combined'
            status TEXT NOT NULL, -- 'running', 'paused', 'stopped', 'completed'
            minimized INTEGER DEFAULT 0 -- 0 = normal, 1 = minimized
        )
    """)
    
    # Execution Results Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            req_id TEXT NOT NULL,
            input_req TEXT NOT NULL,
            status TEXT NOT NULL, -- 'PASS', 'FAIL', 'REVIEW'
            failed_rule TEXT,
            rationale TEXT,
            corrected_req TEXT,
            swe1_id TEXT, -- populated for SWE.2 traceability
            FOREIGN KEY (run_id) REFERENCES execution_runs(run_id)
        )
    """)
    
    conn.commit()
    conn.close()

# Helper accessors
def save_guidelines(guideline_id: str, name: str, data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO guidelines (id, name, content) VALUES (?, ?, ?)",
        (guideline_id, name, json.dumps(data))
    )
    conn.commit()
    conn.close()

def get_all_guidelines():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at FROM guidelines")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_guideline_content(guideline_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM guidelines WHERE id = ?", (guideline_id,))
    row = cursor.fetchone()
    conn.close()
    return json.loads(row["content"]) if row else None

def get_guideline_details(guideline_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, content FROM guidelines WHERE id = ?", (guideline_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "content": json.loads(row["content"])
        }
    return None

def save_chunk_log(doc_name: str, chunk_index: int, text: str, tokens: int, qdrant_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chunks (doc_name, chunk_index, chunk_text, token_count, qdrant_id) VALUES (?, ?, ?, ?, ?)",
        (doc_name, chunk_index, text, tokens, qdrant_id)
    )
    conn.commit()
    conn.close()

def clear_chunks_for_doc(doc_name: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chunks WHERE doc_name = ?", (doc_name,))
    conn.commit()
    conn.close()

def get_chunking_metrics():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total_chunks, SUM(token_count) as total_tokens, AVG(token_count) as avg_tokens FROM chunks")
    row = cursor.fetchone()
    conn.close()
    if row and row["total_chunks"] > 0:
        return {
            "total_chunks": row["total_chunks"],
            "total_tokens": row["total_tokens"],
            "avg_tokens": round(row["avg_tokens"], 1)
        }
    return {"total_chunks": 0, "total_tokens": 0, "avg_tokens": 0}

def save_execution_run(run_id: str, run_type: str, status: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO execution_runs (run_id, type, status) VALUES (?, ?, ?)",
        (run_id, run_type, status)
    )
    conn.commit()
    conn.close()

def update_execution_status(run_id: str, status: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE execution_runs SET status = ? WHERE run_id = ?", (status, run_id))
    conn.commit()
    conn.close()

def update_execution_minimized(run_id: str, minimized: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE execution_runs SET minimized = ? WHERE run_id = ?", (minimized, run_id))
    conn.commit()
    conn.close()

def save_execution_result(run_id: str, req_id: str, input_req: str, status: str, failed_rule: str, rationale: str, corrected_req: str, swe1_id: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO execution_results (run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id)
    )
    conn.commit()
    conn.close()

def get_previous_executions(limit: int = 10):
    conn = get_connection()
    cursor = conn.cursor()
    # Fetch execution runs with a summary count of pass, fail, review
    cursor.execute(f"""
        SELECT 
            r.run_id, r.timestamp, r.type, r.status, r.minimized,
            SUM(CASE WHEN s.status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
            SUM(CASE WHEN s.status = 'FAIL' THEN 1 ELSE 0 END) as fail_count,
            SUM(CASE WHEN s.status = 'REVIEW' THEN 1 ELSE 0 END) as review_count,
            COUNT(s.id) as total_count
        FROM execution_runs r
        LEFT JOIN execution_results s ON r.run_id = s.run_id
        GROUP BY r.run_id
        ORDER BY r.timestamp DESC
        LIMIT {limit}
    """)
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        row_dict = dict(r)
        if "timestamp" in row_dict and row_dict["timestamp"]:
            row_dict["timestamp"] = row_dict["timestamp"].replace(" ", "T") + "Z"
        results.append(row_dict)
    return results

def get_execution_results(run_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM execution_results WHERE run_id = ? ORDER BY id ASC", (run_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_execution_run(run_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM execution_results WHERE run_id = ?", (run_id,))
    cursor.execute("DELETE FROM execution_runs WHERE run_id = ?", (run_id,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DATABASE_PATH)
