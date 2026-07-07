import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
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
        
        <div *ngIf="history.length === 0" class="no-runs" style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px 0;">
          No previous analysis execution runs found. Go to the <strong>Requirement Analysis</strong> tab to upload and evaluate requirements!
        </div>

        <div *ngIf="history.length > 0" class="minimized-shelf">
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
              <div class="results-summary">
                <span class="badge badge-pass">{{ run.pass_count }} Pass</span>
                <span class="badge badge-review">{{ run.review_count + run.fail_count }} Review</span>
                <span class="total-text">Total: {{ run.total_count }} requirements</span>
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
                      <th style="padding: 8px;">Corrected Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of expandedResults[run.run_id]" style="border-bottom: 1px solid #edf2f7;">
                      <td style="padding: 8px; font-weight: 600; color: var(--text-primary); white-space: nowrap;">{{ row.req_id }}</td>
                      <td style="padding: 8px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);" [title]="row.input_req">{{ row.input_req }}</td>
                      <td style="padding: 8px;">
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'" style="font-size: 0.7rem; padding: 2px 6px;">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </span>
                      </td>
                      <td style="padding: 8px; color: var(--text-secondary); font-size: 0.75rem;">
                        <div *ngIf="row.failed_rule" style="font-weight: 600; color: #b06000; margin-bottom: 2px;">Rule: {{ row.failed_rule }}</div>
                        <div style="max-width: 350px; line-height: 1.3;" [title]="row.rationale">{{ row.rationale }}</div>
                      </td>
                      <td style="padding: 8px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1;" [title]="row.corrected_req || '-'">
                        {{ row.corrected_req || '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
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
  `]
})
export class DashboardComponent implements OnInit {
  @Output() viewRun = new EventEmitter<string>();
  
  @Input() set active(val: boolean) {
    if (val) {
      this.loadData();
    }
  }

  history: any[] = [];
  ragMetrics: any = {};
  overallPassRate: number = 0;
  expandedResults: { [runId: string]: any[] } = {};

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.apiService.getHistory().subscribe({
      next: (res) => {
        this.history = res;
        this.calculatePassRate();
        
        // Pre-fetch results for any already expanded cards
        this.history.forEach(run => {
          if (run.minimized !== 1) {
            this.apiService.getRunResults(run.run_id).subscribe(details => {
              this.expandedResults[run.run_id] = details;
            });
          }
        });
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
}
