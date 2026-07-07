import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-rag-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rag-container">
      <div class="grid grid-2">
        <!-- Training & Chunking logs card -->
        <div class="card">
          <div class="card-title">📚 Document Ingestion & RAG Training</div>
          <p class="section-desc">Upload guideline PDF or JSON files (INCOSE, ASPICE) to train the RAG database progressively.</p>
          
          <div class="dropzone" (click)="fileInput.click()">
            <span class="dropzone-icon">📥</span>
            <span class="dropzone-text">Click to choose a guideline file (.json, .pdf, .txt)</span>
            <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none;" accept=".json,.pdf,.txt">
          </div>
          
          <!-- File selection details -->
          <div *ngIf="selectedFile && !showConfigDialog" class="file-details" style="display: flex; flex-direction: column; align-items: stretch; gap: 8px; margin-top: 12px;">
            <div>Selected: <strong>{{ selectedFile.name }}</strong> ({{ (selectedFile.size / 1024) | number:'1.0-1' }} KB)</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              Target Collection: <strong>{{ collectionMode === 'create' ? newCollectionName : selectedCollection }}</strong>
              <span *ngIf="isPdf"> | Pages: <strong>{{ startPage }} to {{ endPage }}</strong></span>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 4px;">
              <button class="btn btn-primary btn-sm" style="flex: 1;" [disabled]="isTraining" (click)="startIngestion()">Start Ingestion</button>
              <button class="btn btn-secondary btn-sm" [disabled]="isTraining" (click)="showConfigDialog = true">Edit Config</button>
            </div>
          </div>

          <!-- Progressive Training Log -->
          <div *ngIf="isTraining || logs.length > 0" class="progress-section">
            <div class="progress-meta">
              <span>Ingestion Progress</span>
              <span>{{ progressPercent }}% ({{ processedChunks }}/{{ totalChunks }} chunks)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar" [style.width.%]="progressPercent"></div>
            </div>
            
            <div class="log-container">
              <div class="log-title">Progressive DB Upsert Logs:</div>
              <div class="log-window">
                <div *ngFor="let log of logs" class="log-entry">
                  <span class="log-time">{{ log.time | date:'HH:mm:ss' }}</span>
                  <span class="log-msg">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Metrics and Evaluation Search Bar -->
        <div class="grid" style="gap: 20px;">
          <!-- Metrics card -->
          <div class="card">
            <div class="card-title">📈 Current Chunking Metrics</div>
            <div class="metrics-grid">
              <div class="metric-item">
                <span class="metric-lbl">Total Chunks:</span>
                <span class="metric-val">{{ metrics.total_chunks }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-lbl">Avg Chunk Size:</span>
                <span class="metric-val">{{ metrics.avg_tokens }} tokens</span>
              </div>
              <div class="metric-item">
                <span class="metric-lbl">Total Tokens:</span>
                <span class="metric-val">{{ metrics.total_tokens }}</span>
              </div>
            </div>
          </div>

          <!-- Retrieval Search Bar Evaluation -->
          <div class="card">
            <div class="card-title">🔍 Manual Retrieval Evaluation</div>
            <p class="section-desc">Search guidelines to check the semantic relevance and retrieval score from Qdrant.</p>
            
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Target Collection to Search:</label>
              <select [(ngModel)]="searchCollection" (change)="onSearchCollectionChanged()">
                <option *ngFor="let col of collections" [value]="col">{{ col }}</option>
              </select>
            </div>

            <div class="search-box">
              <input type="text" [(ngModel)]="searchQuery" placeholder="Enter keyword or requirement sentence..." (keyup.enter)="evaluateSearch()">
              <button class="btn btn-primary" (click)="evaluateSearch()" [disabled]="!searchQuery">Search</button>
            </div>
            
            <div *ngIf="searchResults.length > 0" class="search-results">
              <div *ngFor="let result of searchResults" class="result-card">
                <div class="result-header">
                  <span class="result-doc">Source: {{ result.doc_name }}</span>
                  <span class="result-score">Score: <strong>{{ result.score | number:'1.3-3' }}</strong></span>
                </div>
                <div class="result-text">"{{ result.text }}"</div>
              </div>
            </div>
            <div *ngIf="searched && searchResults.length === 0" class="no-results">
              No matching guideline chunks found. Ensure you have trained guidelines!
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configure Collection & Extraction Parameters Modal Dialog -->
    <div class="modal-backdrop" *ngIf="showConfigDialog">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Configure Ingestion Parameters</h3>
          <button class="modal-close" (click)="closeDialog()">&times;</button>
        </div>
        
        <div class="modal-body">
          <p>📂 <strong>File Uploaded:</strong> <code>{{ selectedFile?.name }}</code></p>
          
          <!-- 1. Target Collection Section -->
          <h4 style="margin-top: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">🗃️ 1. Target Collection</h4>
          <div class="radio-group" style="margin-bottom: 12px; display: flex; gap: 16px; margin-top: 6px;">
            <label class="radio-lbl">
              <input type="radio" name="col_mode" value="add" [(ngModel)]="collectionMode"> Add to Existing
            </label>
            <label class="radio-lbl">
              <input type="radio" name="col_mode" value="create" [(ngModel)]="collectionMode"> Create New
            </label>
          </div>
          
          <div class="form-group" *ngIf="collectionMode === 'add'">
            <label class="form-label">Select Target Collection:</label>
            <select [(ngModel)]="selectedCollection" style="width: 100%;">
              <option *ngFor="let col of collections" [value]="col">{{ col }}</option>
              <option *ngIf="collections.length === 0" value="aaram_guidelines">aaram_guidelines (Default)</option>
            </select>
          </div>
          
          <div class="form-group" *ngIf="collectionMode === 'create'">
            <label class="form-label">Enter New Collection Name:</label>
            <input type="text" [(ngModel)]="newCollectionName" placeholder="e.g. autosar_manuals" style="width: 100%;">
          </div>
          
          <!-- 2. Extraction Parameters Section -->
          <div *ngIf="isPdf" style="margin-top: 16px;">
            <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">⚙️ 2. PDF Extraction Parameters</h4>
            <p class="section-desc" *ngIf="totalPages > 0">Loaded document contains {{ totalPages }} pages.</p>
            <div class="grid grid-2" style="margin-top: 8px; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Start Page:</label>
                <input type="number" [(ngModel)]="startPage" min="1" [max]="totalPages" style="width: 100%;">
              </div>
              <div class="form-group">
                <label class="form-label">End Page:</label>
                <input type="number" [(ngModel)]="endPage" min="1" [max]="totalPages" style="width: 100%;">
              </div>
            </div>
            <div *ngIf="startPage > endPage" class="alert alert-danger" style="font-size: 0.8rem; color: var(--color-danger); padding: 8px; background: #fce8e6; border-radius: 4px; margin-top: 8px;">
              Start Page cannot be greater than End Page.
            </div>
          </div>
          
          <div *ngIf="!isPdf" style="margin-top: 16px;">
            <h4 style="border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">⚙️ 2. File Parameters</h4>
            <p class="section-desc" *ngIf="selectedFile?.name?.endsWith('.xlsx') || selectedFile?.name?.endsWith('.xls')">Excel binary row parsing will be used.</p>
            <p class="section-desc" *ngIf="!selectedFile?.name?.endsWith('.xlsx') && !selectedFile?.name?.endsWith('.xls')">Direct text content parsing will be used.</p>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeDialog()">Cancel</button>
          <button class="btn btn-primary" [disabled]="!isConfigValid()" (click)="confirmConfig()">🧱 Confirm & Ingest</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .section-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .file-details {
      margin-top: 12px;
      background: var(--bg-primary);
      padding: 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      border: 1px solid var(--border-color);
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
    .progress-section {
      margin-top: 20px;
    }
    .progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .progress-bar-bg {
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .progress-bar {
      height: 100%;
      background: var(--color-success);
      transition: width 0.2s ease-in-out;
    }
    .log-container {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: #212529;
      color: #f8f9fa;
      padding: 12px;
    }
    .log-window {
      height: 160px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .log-entry {
      display: flex;
      gap: 12px;
    }
    .log-time {
      color: #6c757d;
    }
    .log-msg {
      color: #a3cfbb;
    }
    .metrics-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .metric-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
    }
    .metric-item:last-child {
      border-bottom: none;
    }
    .metric-lbl {
      color: var(--text-secondary);
    }
    .metric-val {
      font-weight: 600;
      color: var(--text-primary);
    }
    .search-box {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }
    .search-box input {
      flex-grow: 1;
    }
    .search-results {
      max-height: 250px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .result-card {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      background-color: #fafafa;
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }
    .result-score {
      color: var(--color-primary);
    }
    .result-text {
      font-size: 0.8rem;
      color: var(--text-primary);
      font-style: italic;
    }
    .no-results {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-align: center;
      padding: 16px;
    }

    /* Modal dialog styling overlay */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }
    
    .modal-card {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 12px;
      width: 90%;
      max-width: 550px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-header h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    
    .modal-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-secondary);
      line-height: 1;
      padding: 0;
    }
    
    .modal-close:hover {
      color: var(--text-primary);
    }
    
    .modal-body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .modal-body h4 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 16px;
      margin-bottom: 8px;
    }
    
    .modal-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .radio-lbl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      cursor: pointer;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class RAGConfigComponent implements OnInit {
  selectedFile: File | null = null;
  isTraining: boolean = false;
  progressPercent: number = 0;
  totalChunks: number = 0;
  processedChunks: number = 0;
  logs: Array<{ time: Date; message: string }> = [];
  
  metrics = {
    total_chunks: 0,
    total_tokens: 0,
    avg_tokens: 0
  };

  searchQuery: string = '';
  searchResults: any[] = [];
  searched: boolean = false;

  // Dialog parameters
  showConfigDialog = false;
  collections: string[] = [];
  collectionMode: 'add' | 'create' = 'add';
  selectedCollection: string = 'aaram_guidelines';
  newCollectionName: string = '';
  isPdf = false;
  startPage = 1;
  endPage = 1;
  totalPages = 0;
  searchCollection = 'aaram_guidelines';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadMetrics();
    this.loadCollections();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.isPdf = file.name.toLowerCase().endsWith('.pdf');
      
      this.loadCollections();

      if (this.isPdf) {
        this.apiService.inspectPdf(file).subscribe({
          next: (res) => {
            this.totalPages = res.pages;
            this.startPage = 1;
            this.endPage = res.pages;
            this.showConfigDialog = true;
          },
          error: (err) => {
            alert('Failed to inspect PDF: ' + (err.error?.detail || err.message));
          }
        });
      } else {
        this.showConfigDialog = true;
      }
    }
  }

  loadMetrics() {
    this.apiService.getRagMetrics().subscribe({
      next: (res) => {
        this.metrics = res;
      }
    });
  }

  loadCollections() {
    this.apiService.getRagCollections().subscribe({
      next: (cols) => {
        this.collections = cols;
        if (cols.includes('aaram_guidelines')) {
          this.selectedCollection = 'aaram_guidelines';
          this.searchCollection = 'aaram_guidelines';
        } else if (cols.includes('requalitrace_guidelines')) {
          this.selectedCollection = 'requalitrace_guidelines';
          this.searchCollection = 'requalitrace_guidelines';
        } else if (cols.length > 0) {
          this.selectedCollection = cols[0];
          this.searchCollection = cols[0];
        } else {
          this.selectedCollection = 'aaram_guidelines';
          this.searchCollection = 'aaram_guidelines';
        }
      }
    });
  }

  closeDialog() {
    this.showConfigDialog = false;
    this.selectedFile = null;
  }

  confirmConfig() {
    this.showConfigDialog = false;
    this.startIngestion();
  }

  isConfigValid(): boolean {
    if (this.collectionMode === 'create' && !this.newCollectionName.trim()) {
      return false;
    }
    if (this.isPdf) {
      if (this.startPage < 1 || this.endPage < 1 || this.startPage > this.totalPages || this.endPage > this.totalPages || this.startPage > this.endPage) {
        return false;
      }
    }
    return true;
  }

  startIngestion() {
    if (!this.selectedFile) return;
    this.isTraining = true;
    this.progressPercent = 0;
    this.processedChunks = 0;
    this.logs = [];
    
    const targetCol = this.collectionMode === 'create' ? this.newCollectionName.trim() : this.selectedCollection;
    
    this.addLog(`Starting document ingestion: ${this.selectedFile.name}...`);
    this.addLog(`Target Collection: ${targetCol} (Mode: ${this.collectionMode === 'create' ? 'Create' : 'Add'})`);
    if (this.isPdf) {
      this.addLog(`Slicing pages: ${this.startPage} to ${this.endPage}`);
    }
    
    this.apiService.trainRAG(
      this.selectedFile,
      targetCol,
      this.collectionMode === 'create' ? 'create' : 'add',
      this.isPdf ? this.startPage : undefined,
      this.isPdf ? this.endPage : undefined
    ).subscribe({
      next: (event) => {
        if (event.status === 'started') {
          this.totalChunks = event.total_chunks;
          this.addLog(`File parsed. Segmented into ${this.totalChunks} chunks.`);
        } else if (event.status === 'processing') {
          this.processedChunks = event.processed;
          this.progressPercent = Math.round((this.processedChunks / this.totalChunks) * 100);
          this.addLog(`Chunk ${this.processedChunks}/${this.totalChunks} saved progressively to Qdrant & SQLite database.`);
        } else if (event.status === 'completed') {
          this.isTraining = false;
          this.progressPercent = 100;
          this.metrics = event.metrics;
          this.addLog(`Training completed successfully! Progressive commits completed.`);
          this.loadCollections(); // Refresh collections list
        }
      },
      error: (err) => {
        this.isTraining = false;
        this.addLog(`Error during training: ${err.message || err}`);
      }
    });
  }

  addLog(message: string) {
    this.logs.push({ time: new Date(), message });
    // Scroll window
    setTimeout(() => {
      const window = document.querySelector('.log-window');
      if (window) {
        window.scrollTop = window.scrollHeight;
      }
    }, 50);
  }

  onSearchCollectionChanged() {
    this.searchResults = [];
    this.searched = false;
  }

  evaluateSearch() {
    if (!this.searchQuery) return;
    this.searched = true;
    this.apiService.searchRag(this.searchQuery, 5, this.searchCollection).subscribe({
      next: (res) => {
        this.searchResults = res;
      }
    });
  }
}
