import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-rag-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rag-container">
      <div style="margin-bottom: 24px;">
        <h2 class="section-title" style="margin-bottom: 4px;">Knowledge Engine Configuration</h2>
        <p class="section-desc">Ingest standards and evaluate semantic search retrieval.</p>
      </div>

      <div class="grid grid-2" style="align-items: start;">
        
        <!-- Left Column: Ingestion & Logs -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- Document Ingestion Card -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 20px;">
              Document Ingestion & Training
            </div>
            
            <div class="dropzone" (click)="fileInput.click()">
              <div class="dropzone-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              </div>
              <div class="dropzone-text">Click or drag to upload standards</div>
              <div class="dropzone-subtext">.pdf, .txt, .json formats supported</div>
              <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none;" accept=".json,.pdf,.txt">
            </div>
            
            <!-- File selection details -->
            <div *ngIf="selectedFile && !showConfigDialog" class="file-details">
              <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 6px; background: var(--bg-card); margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                  <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">{{ selectedFile.name }}</span>
                </div>
                <button class="icon-btn-minimal" (click)="selectedFile = null; logs = [];" aria-label="Remove file">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 16px;">
                <div style="color: var(--text-secondary);">Target: <strong style="color: var(--text-primary);">{{ collectionMode === 'create' ? newCollectionName : selectedCollection }}</strong></div>
                <div *ngIf="isPdf" style="color: var(--text-secondary);">Pages: <strong style="color: var(--text-primary);">{{ startPage }}-{{ endPage }}</strong></div>
              </div>
              
              <div style="display: flex; gap: 10px;">
                <button class="btn btn-primary" style="flex: 1;" [disabled]="isTraining" (click)="startIngestion()">Start Ingestion</button>
                <button class="btn btn-secondary" [disabled]="isTraining" (click)="showConfigDialog = true">Edit Config</button>
              </div>
            </div>

            <!-- Progressive Training Log -->
            <div *ngIf="isTraining || logs.length > 0" class="progress-section" style="margin-top: 24px;">
              <div class="progress-meta">
                <span>Ingestion Progress</span>
                <span>{{ progressPercent }}% ({{ processedChunks }}/{{ totalChunks }} chunks)</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar" [style.width.%]="progressPercent"></div>
              </div>
            </div>
          </div>
          
          <!-- Terminal Logs -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 12px;">
              Training Progress Log
            </div>
            <div class="log-container">
              <div class="log-window">
                <div *ngFor="let log of logs" class="log-entry">
                  <span class="log-time">[{{ log.time | date:'HH:mm:ss' }}]</span>
                  <span class="log-msg">{{ log.message }}</span>
                </div>
                <div *ngIf="logs.length === 0" style="color: #64748b; font-style: italic;">Awaiting ingestion task...</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Metrics & Evaluation -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Metrics card -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 20px;">
              Chunking Metrics
            </div>
            
            <div style="display: flex; gap: 16px;">
              <div style="flex: 1; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; background: var(--bg-card);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Total Chunks</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: var(--text-primary);">{{ metrics.total_chunks }}</div>
              </div>
              
              <div style="flex: 1; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; background: var(--bg-card);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;">Total Tokens</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: var(--text-primary);">{{ metrics.total_tokens | number }}</div>
              </div>
            </div>
          </div>

          <!-- Retrieval Search Bar Evaluation -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 12px;">
              Manual Retrieval Evaluation
            </div>
            <p class="section-desc" style="margin-bottom: 20px;">Search guidelines to check semantic relevance and retrieval accuracy.</p>
            
            <div class="form-group" style="margin-bottom: 16px;">
              <select [(ngModel)]="searchCollection" (change)="onSearchCollectionChanged()" style="width: 100%; max-width: 300px; font-size: 0.8rem; padding: 8px 12px;">
                <option *ngFor="let col of collections" [value]="col">Target: {{ col }}</option>
              </select>
            </div>

            <div class="search-box">
              <input type="text" [(ngModel)]="searchQuery" placeholder="Enter keyword or requirement sentence..." (keyup.enter)="evaluateSearch()">
              <button class="btn btn-primary" (click)="evaluateSearch()" [disabled]="!searchQuery">Search</button>
            </div>
            
            <div *ngIf="searchResults.length > 0" class="search-results">
              <div *ngFor="let result of searchResults" class="result-card">
                <div class="result-text">"{{ result.text }}"</div>
                <div class="result-footer">
                  <span class="result-doc">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: text-bottom;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    {{ result.doc_name }}
                  </span>
                  <span class="result-score">Score: <strong>{{ result.score | number:'1.3-3' }}</strong></span>
                </div>
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
              <option *ngIf="collections.length === 0" value="airam_guidelines">airam_guidelines (Default)</option>
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
    .icon-btn-minimal {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
      padding: 4px;
      border-radius: 4px;
    }
    .icon-btn-minimal:hover {
      color: var(--text-primary);
      background-color: #f1f5f9;
    }
    .file-details {
      margin-top: 20px;
    }
    .progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .progress-bar-bg {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.2s ease-in-out;
    }
    .log-container {
      border: 1px solid #334155;
      border-radius: 8px;
      background: #0f172a;
      color: #f8fafc;
      padding: 16px;
    }
    .log-window {
      height: 200px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .log-entry {
      display: flex;
      gap: 12px;
      line-height: 1.4;
    }
    .log-time {
      color: #64748b;
      flex-shrink: 0;
    }
    .log-msg {
      color: #10b981;
      word-break: break-word;
    }
    
    .search-box {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .search-box input {
      flex-grow: 1;
    }
    .search-results {
      max-height: 350px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-right: 4px;
    }
    .result-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      background-color: var(--bg-card);
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .result-text {
      font-size: 0.85rem;
      color: var(--text-primary);
      font-style: italic;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .result-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      border-top: 1px solid var(--border-color);
      padding-top: 12px;
    }
    .result-doc {
      color: var(--text-secondary);
      font-weight: 500;
    }
    .result-score {
      color: var(--color-primary);
      background: #eff6ff;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
    }
    .no-results {
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-align: center;
      padding: 24px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px dashed var(--border-color);
    }

    /* Modal dialog styling overlay */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }
    
    .modal-card {
      background: var(--bg-card);
      border-radius: 12px;
      width: 90%;
      max-width: 550px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .modal-header {
      padding: 20px 24px;
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
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .modal-body h4 {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 20px;
      margin-bottom: 12px;
    }
    
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: #f8fafc;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
    
    .radio-lbl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--text-primary);
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
  selectedCollection: string = 'airam_guidelines';
  newCollectionName: string = '';
  isPdf = false;
  startPage = 1;
  endPage = 1;
  totalPages = 0;
  searchCollection = 'airam_guidelines';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

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
        if (cols.includes('airam_guidelines')) {
          this.selectedCollection = 'airam_guidelines';
          this.searchCollection = 'airam_guidelines';
        } else if (cols.includes('requalitrace_guidelines')) {
          this.selectedCollection = 'requalitrace_guidelines';
          this.searchCollection = 'requalitrace_guidelines';
        } else if (cols.length > 0) {
          this.selectedCollection = cols[0];
          this.searchCollection = cols[0];
        } else {
          this.selectedCollection = 'airam_guidelines';
          this.searchCollection = 'airam_guidelines';
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isTraining = false;
        this.addLog(`Error during training: ${err.message || err}`);
        this.cdr.detectChanges();
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
