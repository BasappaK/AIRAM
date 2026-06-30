import { Component, OnInit, EventEmitter, Output } from '@angular/core';
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
        <div class="card-title">📊 Execution Run Summaries</div>
        
        <div *ngIf="history.length === 0" class="no-runs">
          No previous analysis execution runs found. Go to the <strong>Requirement Analysis</strong> tab to upload and evaluate requirements!
        </div>

        <div *ngIf="history.length > 0" class="runs-list">
          <div *ngFor="let run of history" class="run-row">
            <div class="run-meta">
              <span class="run-type">{{ run.type | uppercase }} RUN</span>
              <span class="run-date">{{ run.timestamp | date:'medium' }}</span>
              <span class="badge" [class.badge-pass]="run.status === 'completed'" [class.badge-fail]="run.status === 'stopped'" [class.badge-running]="run.status === 'running' || run.status === 'paused'">
                {{ run.status }}
              </span>
            </div>
            
            <div class="run-bar-container">
              <!-- Progressive stacked ratio bar -->
              <div class="run-bar">
                <div class="bar-segment bar-pass" [style.width.%]="getPercentage(run.pass_count, run.total_count)" title="Pass"></div>
                <div class="bar-segment bar-review" [style.width.%]="getPercentage(run.review_count, run.total_count)" title="Review"></div>
                <div class="bar-segment bar-fail" [style.width.%]="getPercentage(run.fail_count, run.total_count)" title="Fail"></div>
              </div>
              <div class="run-metrics">
                <span class="text-success">{{ run.pass_count }} Pass</span> | 
                <span class="text-warning">{{ run.review_count }} Review</span> | 
                <span class="text-danger">{{ run.fail_count }} Fail</span>
                <span class="text-total">({{ run.total_count }} total)</span>
              </div>
            </div>
            
            <div class="run-actions">
              <button class="btn btn-secondary btn-sm" (click)="viewRun.emit(run.run_id)">View Details</button>
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
  `]
})
export class DashboardComponent implements OnInit {
  @Output() viewRun = new EventEmitter<string>();
  
  history: any[] = [];
  ragMetrics: any = {};
  overallPassRate: number = 0;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.apiService.getHistory().subscribe({
      next: (res) => {
        this.history = res;
        this.calculatePassRate();
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
}
