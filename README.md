# AIRAM - AI-Assisted Requirement Analysis & Management ✦

AIRAM is an agentic automotive requirements analysis and compliance validation tool. It provides:
1. **Requirements Compliance & Quality Auditor**: Evaluates software requirements (such as SWE.1 HLR or SWE.2 LLR) against strict guidelines (e.g. INCOSE, ASPICE rules) using LLMs and gives audit statuses (PASS / REVIEW) along with suggested rewrites if violations are found.
2. **Requirements Traceability Analyzer**: Evaluates tracing compliance between Low-Level Software Requirements (SWE.2) and High-Level System Requirements (SWE.1).
3. **RAG (Retrieval-Augmented Generation) Ingestion**: Supports progressive database segmenting and indexing of guidelines documents (such as PDF files, Excel lists, CSVs, TXTs) using layout-aware `pymupdf` and `pymupdf4llm` extraction with configurable target collections and page ranges.
4. **Manual Retrieval Querying**: Lets you verify semantic Qdrant retrieval scores across dynamic custom guideline collections.
5. **Interactive Dashboard**: Visualizes execution history runs, stacked compliance statistics, and Qdrant chunking metrics.

---

## Prerequisites

Before running the application, make sure you have the following installed on your machine:
* **Python**: Version 3.10 or higher
* **Node.js**: Version 18.x or higher, along with **npm** (Node Package Manager)

---

## 1. Backend Setup (FastAPI)

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   - **On Windows (PowerShell/Cmd)**:
     ```powershell
     python -m venv myenv
     .\myenv\Scripts\activate
     ```
   - **On macOS/Linux**:
     ```bash
     python -m venv myenv
     source myenv/bin/activate
     ```

3. Install the required python libraries:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables Configuration**:
   Create a `.env` file in the `backend/` directory and configure the following variables:
   ```env
   # Qdrant Vector Store credentials (Cloud or Local instance)
   QDRANT_URL=https://your-qdrant-url-here.cloud.qdrant.io
   QDRANT_API_KEY=your-qdrant-api-key-here

   # LLM Model Access (NVIDIA NIM or OpenAI compatible base URL)
   OPENAI_API_KEY=nvapi-your-nvidia-nim-api-key-here
   OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
   ```

5. Launch the FastAPI server:
   ```bash
   python main.py
   ```
   The backend server will launch at `http://localhost:8000` and automatically watch for code changes.

---

## 2. Frontend Setup (Angular)

1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```

2. Install the frontend npm node packages:
   ```bash
   npm install
   ```

3. Start the Angular development server:
   ```bash
   npm start
   ```
   The development server will run at `http://localhost:4200/`. Open this URL in your browser to interact with the application.

---

## 3. How to Use the Studio

### Requirement Validation
1. Go to the **Standards Setup** tab to upload strict guidelines files (in JSON format) if using strict guidelines.
2. Go to the **Requirement Analysis** tab.
3. Upload your SWE.1 (HLR) or SWE.2 (LLR) requirements (in CSV or XLSX format).
4. Configure which actions to run (Quality Analysis, Quality Correction, Traceability Analysis, or Traceability Correction) using the checkboxes.
5. Select whether to use the **RAG Engine** (which queries semantic chunks from Qdrant vector database) or **Strict Guidelines** files.
6. Click **Start Execution** to run validation row-by-row with progressive UI updates.

### Progressive RAG Training
1. Go to the **RAG Configuration** tab.
2. Choose a PDF, JSON, or TXT guideline document to upload.
3. The configuration dialog will pop up automatically. Configure your **Target Collection** (Create New or Add to Existing) and **PDF Page Range** (e.g. pages 1 to 5).
4. Confirm and watch the logs list chunking progress and progressive vector commits in real time.
5. Use the **Manual Retrieval Evaluation** search box at the bottom to verify semantic query relevance scores inside your target collection.
