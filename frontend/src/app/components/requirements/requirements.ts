import { Component, OnInit, OnDestroy, Input, HostListener, ElementRef } from '@angular/core';
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

            <!-- Analysis Model selector -->
            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label">Analysis Model</label>
              <select [(ngModel)]="selectedAnalysisModel" style="width: 100%; min-height: 38px;">
                <option value="nvidia/llama-3.3-nemotron-super-49b-v1.5">Llama 3.3 Nemotron 49B (NVIDIA)</option>
              </select>
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
              <div style="display: flex; gap: 8px; align-items: stretch; position: relative;">
                
                <!-- Custom Multi-select Dropdown -->
                <div class="custom-dropdown" style="flex: 1; position: relative;">
                  <!-- Dropdown Toggle Button -->
                  <div class="dropdown-toggle" (click)="toggleDropdown()" style="display: flex; justify-content: space-between; align-items: center; min-height: 38px; border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.9rem; user-select: none;">
                    <span>{{ getSelectedCountText() }}</span>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">▼</span>
                  </div>
                  
                  <!-- Dropdown Options List -->
                  <div class="dropdown-menu-panel" *ngIf="showDropdown" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #fff; border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 1500; max-height: 200px; overflow-y: auto; padding: 6px 0; display: flex; flex-direction: column;">
                    
                    <!-- Select All Option -->
                    <label class="dropdown-item" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                      <input type="checkbox" [checked]="isAllSelected()" (change)="toggleSelectAll()">
                      <span style="font-weight: 600;">Select All</span>
                    </label>
                    <div style="border-bottom: 1px solid var(--border-color); margin: 4px 0;"></div>
                    
                    <!-- Individual Guidelines -->
                    <label *ngFor="let g of guidelines" class="dropdown-item" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                      <input type="checkbox" [checked]="isSelectedGuideline(g.id)" (change)="toggleGuideline(g.id)">
                      <span>{{ g.name }}</span>
                    </label>
                    
                    <div *ngIf="guidelines.length === 0" style="padding: 8px 12px; color: var(--text-secondary); font-size: 0.85rem;">
                      No guidelines uploaded yet.
                    </div>
                  </div>
                </div>

                <button type="button" class="btn btn-secondary" (click)="openUploadModal()" style="padding: 0 14px; font-size: 0.85rem; height: 38px; display: inline-flex; align-items: center; gap: 4px;">
                  🔧 Manage
                </button>
              </div>
            </div>

            <!-- Embedding Model selector (Visible only if RAG search is chosen) -->
            <div class="form-group" *ngIf="useRag" style="margin-top: 12px;">
              <label class="form-label">RAG Embedding Model</label>
              <select [(ngModel)]="selectedEmbedModel" style="width: 100%; min-height: 38px;">
                <option value="nvidia/embeddings-nv-embed-qa-4">nv-embed-qa-4 (NVIDIA)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Execution Control Buttons and Progress Bar -->
        <div class="execution-controls" style="margin-top: 24px;">
          <div class="btn-group">
            <button class="btn btn-primary" (click)="startRun()" *ngIf="!isRunning" [disabled]="!swe1File && !swe2File">
              🚀 Start Execution
            </button>
            <button class="btn btn-warning" (click)="pauseRun()" *ngIf="isRunning && !isPaused">
              ⏸️ Pause
            </button>
            <button class="btn btn-success" (click)="resumeRun()" *ngIf="isRunning && isPaused">
              ▶️ Resume
            </button>
            <button class="btn btn-danger" (click)="stopRun()" *ngIf="isRunning">
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
                  <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                    {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                  </span>
                </td>
                <td style="font-weight: 500; font-family: monospace;">{{ row.failed_rule || 'N/A' }}</td>
                <td style="color: var(--text-secondary); font-size: 0.8rem;">{{ row.rationale }}</td>
                <td style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; padding-left: 10px;">
                  {{ row.corrected_req || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Standards Setup Upload Modal -->
    <div class="modal-backdrop" *ngIf="showUploadModal">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">🔧 Manage & Upload Standards Guidelines</div>
          <button type="button" class="btn-close" (click)="closeUploadModal()">✕</button>
        </div>
        <div class="modal-body">
          <p class="section-desc" style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
            Configure strict standard documents in JSON format (e.g. INCOSE rules list, ASPICE guidelines) to enable validation.
          </p>

          <div class="form-group">
            <label class="form-label">Standards Document Name (e.g. INCOSE Rules, ASPICE SWE.1)</label>
            <input type="text" [(ngModel)]="newStandardName" placeholder="Enter name..." style="width: 100%;">
          </div>

          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">Upload JSON Guidelines File</label>
            <div class="dropzone-mini" (click)="stdInput.click()" [class.has-file]="standardFile">
              <span>📁</span>
              <span>{{ standardFile ? standardFile.name : 'Choose JSON Guidelines File' }}</span>
              <input #stdInput type="file" (change)="onStandardFileSelected($event)" style="display: none;" accept=".json">
            </div>
          </div>

          <button 
            type="button"
            class="btn btn-primary" 
            [disabled]="!newStandardName || !standardFile || isUploadingStandard" 
            (click)="uploadStandard()"
            style="margin-top: 24px; width: 100%;">
            {{ isUploadingStandard ? 'Uploading...' : 'Upload Standards Document' }}
          </button>

          <div *ngIf="uploadedStatus" class="alert alert-success" style="margin-top: 16px; padding: 12px; background: #e6f4ea; color: var(--color-success); border-radius: 6px; font-size: 0.85rem;">
            {{ uploadedStatus }}
          </div>
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

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    .modal-card {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      width: 500px;
      max-width: 90%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      animation: modal-fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      background-color: #f8f9fa;
    }
    .modal-title {
      font-weight: 600;
      font-size: 1rem;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-close {
      background: transparent;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: var(--text-secondary);
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
    }
    .btn-close:hover {
      background-color: #e9ecef;
      color: var(--text-primary);
    }
    .modal-body {
      padding: 24px;
    }
    @keyframes modal-fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    .dropdown-item {
      background-color: transparent;
      transition: background-color 0.2s ease;
    }
    .dropdown-item:hover {
      background-color: #f1f3f5;
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

  useRag: boolean = false;
  guidelines: any[] = [];
  selectedGuidelineIds: string[] = [];
  showDropdown = false;
  
  // Modal Upload bindings
  showUploadModal = false;
  newStandardName = '';
  standardFile: File | null = null;
  isUploadingStandard = false;
  uploadedStatus = '';
  
  selectedEmbedModel = 'nvidia/embeddings-nv-embed-qa-4';
  selectedAnalysisModel = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';

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

  constructor(private apiService: ApiService, private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.loadGuidelines();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.elementRef.nativeElement.querySelector('.custom-dropdown')?.contains(event.target)) {
      this.showDropdown = false;
    }
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  getSelectedCountText(): string {
    if (this.selectedGuidelineIds.length === 0) {
      return '-- Select Guidelines --';
    }
    if (this.selectedGuidelineIds.length === this.guidelines.length && this.guidelines.length > 0) {
      return 'All Guidelines Selected';
    }
    return `${this.selectedGuidelineIds.length} Guideline(s) Selected`;
  }

  isAllSelected(): boolean {
    return this.guidelines.length > 0 && this.selectedGuidelineIds.length === this.guidelines.length;
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedGuidelineIds = [];
    } else {
      this.selectedGuidelineIds = this.guidelines.map(g => g.id);
    }
  }

  isSelectedGuideline(id: string): boolean {
    return this.selectedGuidelineIds.includes(id);
  }

  toggleGuideline(id: string) {
    const idx = this.selectedGuidelineIds.indexOf(id);
    if (idx > -1) {
      this.selectedGuidelineIds.splice(idx, 1);
    } else {
      this.selectedGuidelineIds.push(id);
    }
  }

  openUploadModal() {
    this.showUploadModal = true;
    this.uploadedStatus = '';
    this.newStandardName = '';
    this.standardFile = null;
  }

  closeUploadModal() {
    this.showUploadModal = false;
    this.loadGuidelines();
  }

  onStandardFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.standardFile = file;
    }
  }

  uploadStandard() {
    if (!this.standardFile || !this.newStandardName) return;
    this.isUploadingStandard = true;
    this.uploadedStatus = '';

    this.apiService.uploadGuideline(this.newStandardName, this.standardFile).subscribe({
      next: (res) => {
        this.isUploadingStandard = false;
        this.uploadedStatus = `Successfully uploaded guideline '${res.name}'!`;
        this.newStandardName = '';
        this.standardFile = null;
        this.loadGuidelines();
      },
      error: (err) => {
        this.isUploadingStandard = false;
        alert('Failed to upload guidelines: ' + (err.error?.detail || err.message));
      }
    });
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
      this.selectedGuidelineIds.join(',') || null,
      this.useRag,
      this.selectedAnalysisModel,
      this.swe1File || undefined,
      this.swe2File || undefined,
      this.actions.correct,
      this.actions.correctTrace
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



  getProgressPercent(): number {
    return this.totalRows > 0 ? (this.currentRow / this.totalRows) * 100 : 0;
  }

  exportResults() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Input Requirement,Status,Rule/Trace Target,Rationale,Corrected Requirement\n";
    this.results.forEach(row => {
      const line = [
        row.req_id || '',
        `"${(row.input_req || '').replace(/"/g, '""')}"`,
        row.status || '',
        row.failed_rule || 'N/A',
        `"${(row.rationale || '').replace(/"/g, '""')}"`,
        `"${(row.corrected_req || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += line + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AARAM_Run_${this.activeRunId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
