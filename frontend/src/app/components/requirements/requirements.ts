import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-requirements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="req-container">
      <div class="card">
        <div class="card-title">📝 Requirements Ingestion & Execution Config</div>
        
        <div class="grid grid-2">
          <!-- Left Configuration: Upload fields -->
          <div class="upload-section">
            <div class="form-group">
              <label class="form-label">High Level Requirements (SWE.1 / HLR) - Optional/Traceability Target</label>
              <div class="dropzone-mini" (click)="swe1Input.click()" [class.has-file]="swe1File">
                <span>📁</span>
                <span>{{ swe1File ? swe1File.name : 'Upload SWE.1 / HLR Excel or CSV' }}</span>
                <input #swe1Input type="file" (change)="onFileSelected($event, 'swe1')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>

            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label">Low Level Requirements (SWE.2 / LLR) - Primary Target</label>
              <div class="dropzone-mini" (click)="swe2Input.click()" [class.has-file]="swe2File">
                <span>📁</span>
                <span>{{ swe2File ? swe2File.name : 'Upload SWE.2 / LLR Excel or CSV' }}</span>
                <input #swe2Input type="file" (change)="onFileSelected($event, 'swe2')" style="display: none;" accept=".csv,.xlsx">
              </div>
            </div>
          </div>

          <!-- Right Configuration: Actions & Settings -->
          <div class="config-settings">
            <div class="form-group">
              <label class="form-label">Select Analysis Actions</label>
              <div class="checkbox-group">
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.analyse"> Quality Analysis
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correct"> Quality Correction
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.trace"> Traceability Analysis (SWE.2 to SWE.1)
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correctTrace"> Traceability Correction
                </label>
              </div>
            </div>

            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Rules Evaluation Mode</label>
              <div class="radio-group">
                <label class="radio-lbl">
                  <input type="radio" name="rule_mode" [value]="true" [(ngModel)]="useRag"> RAG Engine Search
                </label>
                <label class="radio-lbl">
                  <input type="radio" name="rule_mode" [value]="false" [(ngModel)]="useRag"> Strict Guidelines File
                </label>
              </div>
            </div>

            <!-- Guidelines File Selector if strict is chosen -->
            <div class="form-group" *ngIf="!useRag" style="margin-top: 12px;">
              <label class="form-label">Strict Guidelines Reference</label>
              <select [(ngModel)]="selectedGuidelineId">
                <option [value]="null">-- Select Uploaded Guidelines File --</option>
                <option *ngFor="let g of guidelines" [value]="g.id">{{ g.name }}</option>
              </select>
            </div>

            <!-- Model selectors -->
            <div class="grid grid-2" style="margin-top: 12px; gap: 10px;">
              <div class="form-group">
                <label class="form-label">RAG Embedding Model</label>
                <select [(ngModel)]="selectedEmbedModel">
                  <option value="nvidia/embeddings-nv-embed-qa-4">nv-embed-qa-4 (NVIDIA)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Analysis Model</label>
                <select [(ngModel)]="selectedAnalysisModel">
                  <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B Instruct</option>
                  <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B Instruct</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Execution Control Buttons and Progress Bar -->
        <div class="execution-controls" style="margin-top: 24px;">
          <div class="btn-group">
            <button class="btn btn-primary" (click)="startRun()" [disabled]="isRunning || (!swe1File && !swe2File)">
              🚀 Start Execution
            </button>
            <button class="btn btn-warning" (click)="pauseRun()" [disabled]="!isRunning || isPaused">
              ⏸️ Pause
            </button>
            <button class="btn btn-success" (click)="resumeRun()" [disabled]="!isRunning || !isPaused">
              ▶️ Resume
            </button>
            <button class="btn btn-danger" (click)="stopRun()" [disabled]="!isRunning">
              🛑 Stop
            </button>
          </div>

          <div *ngIf="isRunning || isFinished" class="progress-bar-container" style="margin-top: 16px;">
            <div class="progress-meta">
              <span>Execution Run ID: <code>{{ activeRunId }}</code></span>
              <span *ngIf="isRunning">Processing Row: {{ currentRow }}/{{ totalRows }}</span>
              <span *ngIf="isFinished">Run Status: <strong>{{ runStatus | uppercase }}</strong></span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar" [class.bg-running]="runStatus === 'running'" [class.bg-paused]="runStatus === 'paused'" [style.width.%]="getProgressPercent()"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Minimized/Minimized Execution History Cards -->
      <div class="card" *ngIf="history.length > 0">
        <div class="card-title">📂 Execution Runs History (Minimized List)</div>
        <div class="minimized-shelf">
          <div *ngFor="let run of history" class="history-card" [class.minimized]="run.minimized === 1">
            <div class="history-header">
              <div class="history-meta">
                <span class="history-type">{{ run.type | uppercase }}</span>
                <span class="history-date">{{ run.timestamp | date:'short' }}</span>
              </div>
              <div class="history-actions">
                <button class="btn btn-sm btn-secondary" (click)="toggleMinimize(run.run_id, run.minimized === 1)">
                  {{ run.minimized === 1 ? 'Expand ⤢' : 'Minimize ⤡' }}
                </button>
                <button class="btn btn-sm btn-primary" (click)="loadResults(run.run_id)">
                  Load Result
                </button>
              </div>
            </div>
            <!-- Expanded content -->
            <div class="history-body" *ngIf="run.minimized !== 1">
              <div class="results-summary">
                <span class="badge badge-pass">{{ run.pass_count }} Pass</span>
                <span class="badge badge-review">{{ run.review_count }} Review</span>
                <span class="badge badge-fail">{{ run.fail_count }} Fail</span>
                <span class="total-text">Total: {{ run.total_count }} requirements</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Results Datatable -->
      <div class="card" *ngIf="results.length > 0">
        <div class="card-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>📋 Analysis Matrix Results</span>
          <button class="btn btn-secondary btn-sm" (click)="exportResults()">📥 Export CSV</button>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Requirement</th>
                <th>Status</th>
                <th>{{ isTraceabilityRun ? 'Traced SWE.1 HLR ID' : 'Violated Rule' }}</th>
                <th>Rationale / Reasoning</th>
                <th>Corrected Requirement</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of results">
                <td style="font-weight: 600; white-space: nowrap;">{{ row.req_id }}</td>
                <td style="max-width: 300px;">{{ row.input_req }}</td>
                <td>
                  <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-fail]="row.status === 'FAIL'" [class.badge-review]="row.status === 'REVIEW'">
                    {{ row.status }}
                  </span>
                </td>
                <td style="font-weight: 500; font-family: monospace;">{{ row.failed_rule || 'N/A' }}</td>
                <td style="color: var(--text-secondary); font-size: 0.8rem;">{{ row.rationale }}</td>
                <td style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; padding-left: 10px;">
                  {{ row.corrected_req }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dropzone-mini {
      border: 1px dashed #ced4da;
      border-radius: 6px;
      padding: 14px;
      background-color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--text-secondary);
      transition: var(--transition);
    }
    .dropzone-mini:hover {
      border-color: var(--color-primary);
      background-color: #f8fafd;
    }
    .dropzone-mini.has-file {
      border-color: var(--color-success);
      color: var(--color-success);
      font-weight: 500;
    }
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }
    .checkbox-lbl, .radio-lbl {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .radio-group {
      display: flex;
      gap: 16px;
      margin-top: 6px;
    }
    .btn-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      margin-bottom: 6px;
    }
    .progress-bar-bg {
      height: 10px;
      background: #e9ecef;
      border-radius: 5px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      transition: width 0.2s ease-in-out;
    }
    .bg-running { background-color: var(--color-primary); }
    .bg-paused { background-color: var(--color-warning); }
    .minimized-shelf {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .history-card {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      background-color: #fff;
      transition: var(--transition);
    }
    .history-card.minimized {
      padding: 6px 12px;
      background-color: #fafafa;
    }
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .history-meta {
      display: flex;
      gap: 12px;
      font-size: 0.8rem;
      align-items: center;
    }
    .history-type {
      font-weight: 600;
    }
    .history-date {
      color: var(--text-secondary);
    }
    .history-actions {
      display: flex;
      gap: 6px;
    }
    .history-body {
      margin-top: 8px;
      border-top: 1px solid var(--border-color);
      padding-top: 8px;
    }
    .results-summary {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 0.8rem;
    }
    .total-text {
      color: var(--text-secondary);
      margin-left: auto;
    }
  `]
})
export class RequirementsComponent implements OnInit, OnDestroy {
  swe1File: File | null = null;
  swe2File: File | null = null;
  
  actions = {
    analyse: true,
    correct: false,
    trace: false,
    correctTrace: false
  };

  useRag: boolean = true;
  guidelines: any[] = [];
  selectedGuidelineId: string | null = null;
  
  selectedEmbedModel = 'nvidia/embeddings-nv-embed-qa-4';
  selectedAnalysisModel = 'meta/llama-3.1-70b-instruct';

  isRunning = false;
  isPaused = false;
  isFinished = false;
  
  activeRunId = '';
  currentRow = 0;
  totalRows = 0;
  runStatus = '';
  
  results: any[] = [];
  history: any[] = [];
  
  isTraceabilityRun = false;
  
  private timerSubscription: any;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadGuidelines();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadGuidelines() {
    this.apiService.getGuidelines().subscribe({
      next: (res) => {
        this.guidelines = res;
      }
    });
  }

  loadHistory() {
    this.apiService.getHistory().subscribe({
      next: (res) => {
        this.history = res;
      }
    });
  }

  onFileSelected(event: any, type: string) {
    const file = event.target.files[0];
    if (file) {
      if (type === 'swe1') {
        this.swe1File = file;
      } else {
        this.swe2File = file;
      }
    }
  }

  startRun() {
    let runType = 'quality';
    if (this.actions.trace || this.actions.correctTrace) {
      runType = 'traceability';
      this.isTraceabilityRun = true;
    } else {
      this.isTraceabilityRun = false;
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.isFinished = false;
    this.runStatus = 'running';
    this.results = [];

    this.apiService.startAnalysis(
      runType,
      this.selectedGuidelineId,
      this.useRag,
      this.selectedAnalysisModel,
      this.swe1File || undefined,
      this.swe2File || undefined
    ).subscribe({
      next: (res) => {
        this.activeRunId = res.run_id;
        this.startPolling();
      },
      error: (err) => {
        alert('Failed to start run: ' + (err.error?.detail || err.message));
        this.isRunning = false;
      }
    });
  }

  startPolling() {
    this.stopPolling();
    this.timerSubscription = setInterval(() => {
      this.apiService.getAnalysisStatus(this.activeRunId).subscribe({
        next: (status) => {
          this.currentRow = status.current_row;
          this.totalRows = status.total_rows;
          this.runStatus = status.status;

          // Fetch intermediate results periodically so user sees requirements committing in real time
          this.apiService.getRunResults(this.activeRunId).subscribe({
            next: (res) => {
              this.results = res;
            }
          });

          if (status.status === 'completed') {
            this.isFinished = true;
            this.isRunning = false;
            this.stopPolling();
            this.loadHistory();
          } else if (status.status === 'stopped') {
            this.isFinished = true;
            this.isRunning = false;
            this.stopPolling();
            this.loadHistory();
          } else if (status.status === 'paused') {
            this.isPaused = true;
          } else {
            this.isPaused = false;
          }
        }
      });
    }, 1000);
  }

  stopPolling() {
    if (this.timerSubscription) {
      clearInterval(this.timerSubscription);
      this.timerSubscription = null;
    }
  }

  pauseRun() {
    if (!this.activeRunId) return;
    this.apiService.pauseAnalysis(this.activeRunId).subscribe(() => {
      this.isPaused = true;
      this.runStatus = 'paused';
    });
  }

  resumeRun() {
    if (!this.activeRunId) return;
    this.apiService.resumeAnalysis(this.activeRunId).subscribe(() => {
      this.isPaused = false;
      this.runStatus = 'running';
    });
  }

  stopRun() {
    if (!this.activeRunId) return;
    this.apiService.stopAnalysis(this.activeRunId).subscribe(() => {
      this.isRunning = false;
      this.isFinished = true;
      this.runStatus = 'stopped';
      this.stopPolling();
      this.loadHistory();
    });
  }

  loadResults(runId: string) {
    this.activeRunId = runId;
    const matchedRun = this.history.find(r => r.run_id === runId);
    this.isTraceabilityRun = matchedRun?.type === 'traceability';
    
    this.apiService.getRunResults(runId).subscribe({
      next: (res) => {
        this.results = res;
      }
    });
  }

  toggleMinimize(runId: string, currentlyMinimized: boolean) {
    this.apiService.minimizeRun(runId, !currentlyMinimized).subscribe(() => {
      this.loadHistory();
    });
  }

  getProgressPercent(): number {
    return this.totalRows > 0 ? (this.currentRow / this.totalRows) * 100 : 0;
  }

  exportResults() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Input Requirement,Status,Rule/Trace Target,Rationale,Corrected Requirement\n";
    this.results.forEach(row => {
      const line = [
        row.req_id,
        `"${row.input_req.replace(/"/g, '""')}"`,
        row.status,
        row.failed_rule || 'N/A',
        `"${row.rationale.replace(/"/g, '""')}"`,
        `"${row.corrected_req.replace(/"/g, '""')}"`
      ].join(",");
      csvContent += line + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ReQualiTrace_Run_${this.activeRunId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
