import { Component, OnInit, EventEmitter, Output, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="grid grid-3">
        <!-- Metric Card 1: Pass Rate -->
        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Requirements Pass Rate</span>
            <span class="metric-icon">📈</span>
          </div>
          <div class="metric-value">{{ overallPassRate }}%</div>
          <div class="metric-footer">Across all evaluated automotive runs</div>
        </div>

        <!-- Metric Card 2: Total Runs -->
        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Total Executions</span>
            <span class="metric-icon">🔄</span>
          </div>
          <div class="metric-value">{{ history.length }}</div>
          <div class="metric-footer">Runs stored in minimized history</div>
        </div>

        <!-- Metric Card 3: RAG Guidelines Chunk count -->
        <div class="card metric-card">
          <div class="metric-header">
            <span class="metric-title">Active RAG Chunks</span>
            <span class="metric-icon">🗂️</span>
          </div>
          <div class="metric-value">{{ ragMetrics.total_chunks || 0 }}</div>
          <div class="metric-footer">Progressively trained chunks in Qdrant</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📂 Execution Runs History</div>
        
        <div *ngIf="isLoadingHistory" class="loading-state" style="padding: 32px; text-align: center; color: var(--text-secondary);">
          <div class="spinner"></div>
          <div style="font-size: 0.9rem; font-weight: 500;">Loading data please wait...</div>
        </div>

        <div *ngIf="!isLoadingHistory && history.length === 0" class="no-runs" style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px 0;">
          No previous analysis execution runs found. Go to the <strong>Requirement Analysis</strong> tab to upload and evaluate requirements!
        </div>

        <div *ngIf="!isLoadingHistory && history.length > 0" class="minimized-shelf">
          <div *ngFor="let run of history" class="history-card" [class.minimized]="run.minimized === 1">
            <div class="history-header">
              <div class="history-meta">
                <span class="history-type" style="text-transform: uppercase;">{{ run.type }} RUN</span>
                <span class="history-date">{{ run.timestamp | date:'short' }}</span>
                <span class="badge" [class.badge-pass]="run.status === 'completed'" [class.badge-fail]="run.status === 'stopped'" [class.badge-running]="run.status === 'running' || run.status === 'paused'">
                  {{ run.status }}
                </span>
              </div>
              <div class="history-actions" style="display: flex; gap: 6px;">
                <button class="btn btn-sm btn-secondary" (click)="toggleMinimize(run.run_id, run.minimized === 1)">
                  {{ run.minimized === 1 ? 'Expand ⤢' : 'Minimize ⤡' }}
                </button>
                <button class="btn btn-sm btn-primary" (click)="viewRun.emit(run.run_id)" >
                  Load Result
                </button>
                <button class="btn btn-sm btn-danger" (click)="deleteRun(run.run_id)" style="padding: 0 10px; display: inline-flex; align-items: center; justify-content: center; height: 32px; background-color: var(--color-danger); border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.8rem;">
                  🗑️ Delete
                </button>
              </div>
            </div>
            <!-- Expanded content -->
            <div class="history-body" *ngIf="run.minimized !== 1">
              <div class="results-summary" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span class="badge badge-pass">{{ run.pass_count }} Pass</span>
                  <span class="badge badge-review">{{ run.review_count + run.fail_count }} Review</span>
                  <span class="total-text" style="margin-left: 8px;">Total: {{ run.total_count }} requirements</span>
                </div>
                <button class="btn btn-secondary btn-sm" (click)="exportRun(run.run_id)" *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0" style="padding: 4px 8px; font-size: 0.75rem; height: 28px; display: inline-flex; align-items: center; gap: 4px;">
                  📥 Export CSV
                </button>
              </div>
              <!-- Progressive stacked ratio bar inside details (only Pass and Review) -->
              <div class="run-bar-container" style="margin-top: 12px;">
                <div class="run-bar" style="display: flex; height: 8px; border-radius: 4px; overflow: hidden; background-color: #e9ecef; width: 100%;">
                  <div class="bar-segment bar-pass" [style.width.%]="getPercentage(run.pass_count, run.total_count)" title="Pass"></div>
                  <div class="bar-segment bar-review" [style.width.%]="getPercentage(run.review_count + run.fail_count, run.total_count)" title="Review"></div>
                </div>
              </div>

              <!-- Mini table of individual requirements status -->
              <div class="results-table-mini" *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0" style="margin-top: 16px; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background-color: #fcfcfc;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); background-color: #f8f9fa; color: var(--text-primary);">
                      <th style="padding: 8px;">ID</th>
                      <th style="padding: 8px;">Requirement</th>
                      <th style="padding: 8px;">Status</th>
                      <th style="padding: 8px;">Violated Rule & Rationale</th>
                      <th style="padding: 8px;" *ngIf="hasCorrections(expandedResults[run.run_id])">Corrected Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of expandedResults[run.run_id] | slice:(getCurrentPage(run.run_id) - 1) * 5:getCurrentPage(run.run_id) * 5" style="border-bottom: 1px solid #edf2f7;">
                      <td style="padding: 8px; font-weight: 600; color: var(--text-primary); white-space: nowrap;">{{ row.req_id }}</td>
                      <td style="padding: 8px; max-width: 300px; color: var(--text-primary); word-break: break-word;" [title]="row.input_req">{{ row.input_req }}</td>
                      <td style="padding: 8px;">
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'" style="font-size: 0.7rem; padding: 2px 6px;">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </span>
                      </td>
                      <td style="padding: 8px; color: var(--text-secondary); font-size: 0.75rem;">
                        <div *ngIf="row.failed_rule" style="font-weight: 600; color: #b06000; margin-bottom: 2px;">Rule: {{ row.failed_rule }}</div>
                        <div style="max-width: 350px; line-height: 1.3; word-break: break-word;" [title]="row.rationale">{{ row.rationale }}</div>
                      </td>
                      <td style="padding: 8px; max-width: 300px; font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; word-break: break-word;" [title]="row.corrected_req || '-'" *ngIf="hasCorrections(expandedResults[run.run_id])">
                        {{ row.corrected_req || '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Pagination Footer -->
                <div class="pagination-footer" *ngIf="expandedResults[run.run_id].length > 5">
                  <div class="pagination-info">
                    Showing <strong>{{ (getCurrentPage(run.run_id) - 1) * 5 + 1 }}</strong> - <strong>{{ getMin((getCurrentPage(run.run_id) * 5), expandedResults[run.run_id].length) }}</strong> of <strong>{{ expandedResults[run.run_id].length }}</strong> requirements
                  </div>
                  <div class="pagination-controls">
                    <button class="btn btn-sm btn-secondary pagination-btn" [disabled]="getCurrentPage(run.run_id) === 1" (click)="setPage(run.run_id, getCurrentPage(run.run_id) - 1)">
                      ‹ Prev
                    </button>
                    <span class="pagination-indicator">Page {{ getCurrentPage(run.run_id) }} of {{ getTotalPages(run.run_id) }}</span>
                    <button class="btn btn-sm btn-secondary pagination-btn" [disabled]="getCurrentPage(run.run_id) === getTotalPages(run.run_id)" (click)="setPage(run.run_id, getCurrentPage(run.run_id) + 1)">
                      Next ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .metric-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-left: 4px solid var(--color-primary);
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
    }
    .metric-value {
      font-size: 2.2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 12px 0;
    }
    .metric-footer {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    .no-runs {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }
    .run-row {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .run-row:last-child {
      border-bottom: none;
    }
    @media (min-width: 768px) {
      .run-row {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .run-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 250px;
    }
    .run-type {
      font-weight: 600;
      font-size: 0.8rem;
    }
    .run-date {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    .run-bar-container {
      flex-grow: 1;
      margin: 0 24px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .run-bar {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      background-color: #e9ecef;
      width: 100%;
    }
    .bar-segment {
      height: 100%;
    }
    .bar-pass { background-color: var(--color-success); }
    .bar-review { background-color: var(--color-warning); }
    .bar-fail { background-color: var(--color-danger); }
    .run-metrics {
      font-size: 0.75rem;
      display: flex;
      gap: 8px;
    }
    .text-success { color: var(--color-success); font-weight: 600; }
    .text-warning { color: #b06000; font-weight: 600; }
    .text-danger { color: var(--color-danger); font-weight: 600; }
    .text-total { color: var(--text-secondary); }
    .btn-sm {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
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
    .pagination-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background-color: #f8f9fa;
      border-top: 1px solid var(--border-color);
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    .pagination-info strong {
      color: var(--text-primary);
    }
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pagination-btn {
      padding: 3px 10px;
      font-size: 0.75rem;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background-color: #fff;
      cursor: pointer;
      transition: var(--transition);
    }
    .pagination-btn:hover:not(:disabled) {
      background-color: #f1f3f5;
      color: var(--color-primary);
      border-color: #ced4da;
    }
    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .pagination-indicator {
      font-weight: 500;
      color: var(--text-primary);
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .spinner {
      display: inline-block;
      width: 28px;
      height: 28px;
      border: 3px solid rgba(13, 110, 253, 0.2);
      border-radius: 50%;
      border-top-color: var(--color-primary);
      animation: spin 1s linear infinite;
      margin-bottom: 12px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  @Output() viewRun = new EventEmitter<string>();
  
  @Input() set active(val: boolean) {
    if (val) {
      this.loadData();
    } else {
      this.expandedResults = {};
    }
  }

  history: any[] = [];
  ragMetrics: any = {};
  overallPassRate: number = 0;
  expandedResults: { [runId: string]: any[] } = {};
  currentPage: { [runId: string]: number } = {};
  isLoadingHistory: boolean = true;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.isLoadingHistory = true;
    this.apiService.getHistory().subscribe({
      next: (res) => {
        this.history = res;
        this.isLoadingHistory = false;
        this.calculatePassRate();
        
        // Pre-fetch results for any already expanded cards
        this.history.forEach(run => {
          if (run.minimized !== 1) {
            this.apiService.getRunResults(run.run_id).subscribe(details => {
              this.expandedResults[run.run_id] = details;
              this.cdr.detectChanges();
            });
          }
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });

    this.apiService.getRagMetrics().subscribe({
      next: (res) => {
        this.ragMetrics = res;
      }
    });
  }

  calculatePassRate() {
    let total = 0;
    let passes = 0;
    this.history.forEach(run => {
      total += run.total_count;
      passes += run.pass_count;
    });
    this.overallPassRate = total > 0 ? Math.round((passes / total) * 100) : 0;
  }

  getPercentage(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }

  toggleMinimize(runId: string, currentlyMinimized: boolean) {
    this.apiService.minimizeRun(runId, !currentlyMinimized).subscribe(() => {
      this.loadData();
      if (currentlyMinimized) { // was minimized, now expanding
        this.apiService.getRunResults(runId).subscribe(res => {
          this.expandedResults[runId] = res;
          this.currentPage[runId] = 1;
        });
      }
    });
  }

  deleteRun(runId: string) {
    if (confirm('Are you sure you want to permanently delete this execution run history?')) {
      this.apiService.deleteRun(runId).subscribe(() => {
        this.loadData();
      });
    }
  }

  getCurrentPage(runId: string): number {
    return this.currentPage[runId] || 1;
  }

  getTotalPages(runId: string): number {
    const total = this.expandedResults[runId]?.length || 0;
    return Math.ceil(total / 5) || 1;
  }

  setPage(runId: string, page: number) {
    const totalPages = this.getTotalPages(runId);
    if (page >= 1 && page <= totalPages) {
      this.currentPage[runId] = page;
    }
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  hasCorrections(rows: any[]): boolean {
    if (!rows || rows.length === 0) return false;
    return rows.some(row => row.corrected_req && row.corrected_req !== '-' && row.corrected_req.trim() !== '');
  }

  exportRun(runId: string) {
    const results = this.expandedResults[runId];
    if (!results || results.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Input Requirement,Status,Rule/Trace Target,Rationale,Corrected Requirement\n";
    results.forEach(row => {
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
    link.setAttribute("download", `AIRAM_Run_${runId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
