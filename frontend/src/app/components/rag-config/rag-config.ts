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
          
          <div *ngIf="selectedFile" class="file-details">
            Selected: <strong>{{ selectedFile.name }}</strong> ({{ (selectedFile.size / 1024) | number:'1.0-1' }} KB)
            <button class="btn btn-primary btn-sm" [disabled]="isTraining" (click)="startIngestion()">Start Ingestion</button>
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
              <div class="log-window" #logWindow>
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
  `,
  styles: [`
    .section-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .file-details {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-primary);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
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
    .log-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: #adb5bd;
      margin-bottom: 8px;
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

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  loadMetrics() {
    this.apiService.getRagMetrics().subscribe({
      next: (res) => {
        this.metrics = res;
      }
    });
  }

  startIngestion() {
    if (!this.selectedFile) return;
    this.isTraining = true;
    this.progressPercent = 0;
    this.processedChunks = 0;
    this.logs = [];
    
    this.addLog(`Starting document ingestion: ${this.selectedFile.name}...`);
    
    this.apiService.trainRAG(this.selectedFile).subscribe({
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

  evaluateSearch() {
    if (!this.searchQuery) return;
    this.searched = true;
    this.apiService.searchRag(this.searchQuery).subscribe({
      next: (res) => {
        this.searchResults = res;
      }
    });
  }
}
