import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "airam.db")

def get_pg_connection():
    if not DATABASE_URL:
        return None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"[database_render] Failed to connect to PostgreSQL: {e}", flush=True)
        return None

def init_pg_db():
    conn = get_pg_connection()
    if not conn:
        return
    try:
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
        
        # Chunks Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id SERIAL PRIMARY KEY,
                doc_name TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                chunk_text TEXT NOT NULL,
                token_count INTEGER NOT NULL,
                qdrant_id TEXT,
                embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Execution Runs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS execution_runs (
                run_id TEXT PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                minimized INTEGER DEFAULT 0
            )
        """)
        
        # Execution Results Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS execution_results (
                id SERIAL PRIMARY KEY,
                run_id TEXT NOT NULL,
                req_id TEXT NOT NULL,
                input_req TEXT NOT NULL,
                status TEXT NOT NULL,
                failed_rule TEXT,
                rationale TEXT,
                corrected_req TEXT,
                swe1_id TEXT
            )
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
        print("[database_render] PostgreSQL tables initialized successfully.", flush=True)
    except Exception as e:
        print(f"[database_render] Error initializing PostgreSQL: {e}", flush=True)

def pull_from_render_to_sqlite():
    """Download all data from Render PG and populate SQLite (run at boot)"""
    conn_pg = get_pg_connection()
    if not conn_pg:
        print("[database_render] No PG URL or connection, skipping pull.", flush=True)
        return
        
    print("[database_render] Restoring local SQLite database from Render Postgres...", flush=True)
    try:
        # Initialize PG tables just in case
        init_pg_db()
        
        cursor_pg = conn_pg.cursor(cursor_factory=RealDictCursor)
        conn_sl = sqlite3.connect(SQLITE_PATH)
        cursor_sl = conn_sl.cursor()
        
        # 1. Guidelines
        cursor_pg.execute("SELECT id, name, content, created_at FROM guidelines")
        for row in cursor_pg.fetchall():
            cursor_sl.execute(
                "INSERT OR REPLACE INTO guidelines (id, name, content, created_at) VALUES (?, ?, ?, ?)",
                (row['id'], row['name'], row['content'], row['created_at'])
            )
            
        # 2. Chunks
        cursor_pg.execute("SELECT id, doc_name, chunk_index, chunk_text, token_count, qdrant_id, embedded_at FROM chunks")
        for row in cursor_pg.fetchall():
            cursor_sl.execute(
                "INSERT OR REPLACE INTO chunks (id, doc_name, chunk_index, chunk_text, token_count, qdrant_id, embedded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (row['id'], row['doc_name'], row['chunk_index'], row['chunk_text'], row['token_count'], row['qdrant_id'], row['embedded_at'])
            )
            
        # 3. Execution Runs
        cursor_pg.execute("SELECT run_id, timestamp, type, status, minimized FROM execution_runs")
        for row in cursor_pg.fetchall():
            cursor_sl.execute(
                "INSERT OR REPLACE INTO execution_runs (run_id, timestamp, type, status, minimized) VALUES (?, ?, ?, ?, ?)",
                (row['run_id'], row['timestamp'], row['type'], row['status'], row['minimized'])
            )
            
        # 4. Execution Results
        cursor_pg.execute("SELECT id, run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id FROM execution_results")
        for row in cursor_pg.fetchall():
            cursor_sl.execute(
                "INSERT OR REPLACE INTO execution_results (id, run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (row['id'], row['run_id'], row['req_id'], row['input_req'], row['status'], row['failed_rule'], row['rationale'], row['corrected_req'], row['swe1_id'])
            )
            
        conn_sl.commit()
        cursor_sl.close()
        conn_sl.close()
        
        cursor_pg.close()
        conn_pg.close()
        print("[database_render] SQLite successfully restored from Render PG.", flush=True)
    except Exception as e:
        print(f"[database_render] Error pulling data: {e}", flush=True)

def sync_sqlite_to_postgres():
    """Upload all current SQLite data to PostgreSQL (fallback backup)"""
    conn_pg = get_pg_connection()
    if not conn_pg:
        return
        
    print("[database_render] Backing up SQLite to Render Postgres...", flush=True)
    try:
        init_pg_db()
        cursor_pg = conn_pg.cursor()
        
        conn_sl = sqlite3.connect(SQLITE_PATH)
        conn_sl.row_factory = sqlite3.Row
        cursor_sl = conn_sl.cursor()
        
        # 1. Sync Guidelines
        cursor_sl.execute("SELECT id, name, content, created_at FROM guidelines")
        for row in cursor_sl.fetchall():
            cursor_pg.execute("""
                INSERT INTO guidelines (id, name, content, created_at) 
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, content = EXCLUDED.content
            """, (row['id'], row['name'], row['content'], row['created_at']))
            
        # 2. Sync Chunks
        cursor_sl.execute("SELECT id, doc_name, chunk_index, chunk_text, token_count, qdrant_id, embedded_at FROM chunks")
        for row in cursor_sl.fetchall():
            cursor_pg.execute("""
                INSERT INTO chunks (id, doc_name, chunk_index, chunk_text, token_count, qdrant_id, embedded_at) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET doc_name = EXCLUDED.doc_name, chunk_index = EXCLUDED.chunk_index, chunk_text = EXCLUDED.chunk_text, token_count = EXCLUDED.token_count, qdrant_id = EXCLUDED.qdrant_id
            """, (row['id'], row['doc_name'], row['chunk_index'], row['chunk_text'], row['token_count'], row['qdrant_id'], row['embedded_at']))
            
        # 3. Sync Execution Runs
        cursor_sl.execute("SELECT run_id, timestamp, type, status, minimized FROM execution_runs")
        for row in cursor_sl.fetchall():
            cursor_pg.execute("""
                INSERT INTO execution_runs (run_id, timestamp, type, status, minimized) 
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (run_id) DO UPDATE SET status = EXCLUDED.status, minimized = EXCLUDED.minimized
            """, (row['run_id'], row['timestamp'], row['type'], row['status'], row['minimized']))
            
        # 4. Sync Execution Results
        cursor_sl.execute("SELECT id, run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id FROM execution_results")
        for row in cursor_sl.fetchall():
            cursor_pg.execute("""
                INSERT INTO execution_results (id, run_id, req_id, input_req, status, failed_rule, rationale, corrected_req, swe1_id) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, failed_rule = EXCLUDED.failed_rule, rationale = EXCLUDED.rationale, corrected_req = EXCLUDED.corrected_req
            """, (row['id'], row['run_id'], row['req_id'], row['input_req'], row['status'], row['failed_rule'], row['rationale'], row['corrected_req'], row['swe1_id']))
            
        conn_pg.commit()
        cursor_pg.close()
        conn_pg.close()
        
        cursor_sl.close()
        conn_sl.close()
        print("[database_render] PostgreSQL database sync completed.", flush=True)
    except Exception as e:
        print(f"[database_render] Error pushing data: {e}", flush=True)
