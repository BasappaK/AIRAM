import { Component, OnInit, EventEmitter, Output, Input, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <div class="grid grid-3" style="margin-bottom: 40px;">
        <!-- Metric Card 1: Pass Rate -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">REQUIREMENTS PASS RATE</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ overallPassRate }}% <span style="font-size: 1rem; font-weight: 500; color: var(--text-secondary);">avg</span></div>
          <div class="metric-footer">Calculated from all history</div>
        </div>

        <!-- Metric Card 2: Total Runs -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">TOTAL EXECUTIONS</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.27l5.25 4.7"></path>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ history.length }}</div>
          <div class="metric-footer">Total stored runs</div>
        </div>

        <!-- Metric Card 3: RAG Guidelines Chunk count -->
        <div class="card metric-card" style="margin-bottom: 0;">
          <div class="metric-header">
            <span class="metric-title">ACTIVE RAG CHUNKS</span>
            <span class="metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
            </span>
          </div>
          <div class="metric-value">{{ ragMetrics.total_chunks || 0 | number }}</div>
          <div class="metric-footer">Qdrant vector chunks</div>
        </div>
      </div>

      <div class="runs-history-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin: 0;">Execution Runs History</h2>
        <div style="display: flex; gap: 12px; position: relative;">
          <!-- Filter Button & Dropdown Container -->
          <div style="position: relative;" #filterContainer>
            <button class="btn btn-secondary" (click)="toggleFilterPanel($event)" [class.active]="showFilterPanel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter
            </button>
            
            <!-- Filter Dropdown -->
            <div *ngIf="showFilterPanel" class="filter-dropdown" style="position: absolute; top: calc(100% + 8px); right: 0; background: white; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; width: 260px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Status</label>
                <select [(ngModel)]="filterStatus" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="running">Running / Paused</option>
                  <option value="stopped">Stopped / Failed</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Run Type</label>
                <select [(ngModel)]="filterType" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Types</option>
                  <option value="quality">Quality Analysis</option>
                  <option value="traceability">Traceability</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Date Filter</label>
                <select [(ngModel)]="filterDate" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; background-color: #f8fafc;">
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          <button class="btn btn-primary" (click)="newExecution.emit()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            New Execution
          </button>
        </div>
      </div>
      
      <div *ngIf="isLoadingHistory" class="loading-state" style="padding: 32px; text-align: center; color: var(--text-secondary);">
        <div class="spinner"></div>
        <div style="font-size: 0.9rem; font-weight: 500;">Loading data please wait...</div>
      </div>

      <div *ngIf="!isLoadingHistory && filteredHistory.length === 0" class="no-runs" style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px 0;">
        No execution runs found matching the filters.
      </div>

      <div *ngIf="!isLoadingHistory && filteredHistory.length > 0" class="minimized-shelf">
        <div *ngFor="let run of filteredHistory" class="history-card" [class.minimized]="run.minimized === 1">
          <div class="history-header">
            <div class="history-meta" style="display: flex; gap: 16px; align-items: center;">
              <span class="badge badge-blue-pill" style="font-size: 0.65rem;">{{ run.type }} RUN</span>
              <div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">{{ run.type === 'quality' ? 'Requirement Validation Suite' : 'Traceability Mapping Audit' }}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">{{ run.timestamp | date:'medium' }}</div>
              </div>
            </div>
            <div class="history-actions" style="display: flex; align-items: center; gap: 16px;">
              <span class="badge" [class.badge-pass]="run.status === 'completed'" [class.badge-fail]="run.status === 'stopped'" [class.badge-running]="run.status === 'running' || run.status === 'paused'" style="margin-right: 8px;">
                {{ run.status }}
              </span>
              
              <button class="icon-btn-minimal" (click)="toggleMinimize(run.run_id, run.minimized === 1)">
                <svg *ngIf="run.minimized === 1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                <svg *ngIf="run.minimized !== 1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              
              <button class="btn btn-primary" style="padding: 6px 16px; font-size: 0.8rem; border-radius: 4px;" (click)="viewRun.emit(run.run_id)" >
                Load Result
              </button>
              
              <button class="icon-btn-minimal text-danger" (click)="deleteRun(run.run_id)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
          
          <!-- Expanded content -->
          <div class="history-body" *ngIf="run.minimized !== 1">
            <div style="display: flex; gap: 24px;">
              
              <!-- Left Column: Summary Metrics -->
              <div class="summary-col" style="flex: 0 0 320px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">Summary Metrics</span>
                  <button *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0" (click)="exportRun(run.run_id)" style="background: none; border: none; color: var(--color-primary); font-size: 0.8rem; font-weight: 500; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export CSV
                  </button>
                </div>
                
                <div *ngIf="run.type === 'quality'" style="margin-bottom: 16px; font-size: 0.8rem; color: var(--text-secondary); background: #f1f5f9; padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-color);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <span><strong style="color: var(--text-primary);">Rules File:</strong> {{ run.guideline_name || 'None' }}</span>
                </div>

                <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                  <div style="flex: 1; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Pass</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: var(--color-success);">{{ run.pass_count }}</div>
                  </div>
                  <div style="flex: 1; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">Review</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #d97706;">{{ run.review_count + run.fail_count }}</div>
                  </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Overall Progress</span>
                  <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary);">{{ getPercentage(run.pass_count, run.total_count) | number:'1.0-0' }}% Success</span>
                </div>
                <div class="run-bar" style="display: flex; height: 10px; border-radius: 5px; overflow: hidden; background-color: #e2e8f0; width: 100%;">
                  <div class="bar-segment bar-pass" [style.width.%]="getPercentage(run.pass_count, run.total_count)" title="Pass" style="background-color: var(--color-success); height: 100%;"></div>
                  <div class="bar-segment bar-review" [style.width.%]="getPercentage(run.review_count + run.fail_count, run.total_count)" title="Review" style="background-color: #d97706; height: 100%;"></div>
                </div>
              </div>

              <!-- Right Column: Mini table -->
              <div class="table-col" style="flex: 1; min-width: 0;" *ngIf="expandedResults[run.run_id] && expandedResults[run.run_id].length > 0">
                <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                  <!-- Quality Table -->
                  <table *ngIf="run.type !== 'traceability'" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #fff;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="padding: 12px 16px; width: 80px;">ID</th>
                        <th style="padding: 12px 16px;">Requirement</th>
                        <th style="padding: 12px 16px; width: 100px;">Status</th>
                        <th style="padding: 12px 16px;">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of expandedResults[run.run_id] | slice:(getCurrentPage(run.run_id) - 1) * 3:getCurrentPage(run.run_id) * 3" style="border-top: 1px solid var(--border-color);">
                        <td style="padding: 16px; font-weight: 600; color: var(--color-primary); white-space: nowrap; vertical-align: top;">{{ row.req_id }}</td>
                        <td style="padding: 16px; color: var(--text-primary); vertical-align: top;">{{ row.input_req }}</td>
                        <td style="padding: 16px; vertical-align: top; font-weight: 700;" [ngStyle]="{'color': row.status === 'PASS' ? 'var(--color-success)' : (row.status === 'FAIL' || row.status === 'REVIEW' ? '#d97706' : 'var(--text-primary)')}">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </td>
                        <td style="padding: 16px; color: var(--text-secondary); vertical-align: top;">
                          {{ row.rationale || 'N/A' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Traceability Table -->
                  <table *ngIf="run.type === 'traceability'" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #fff;">
                    <thead>
                      <tr style="background-color: #f8fafc;">
                        <th style="padding: 12px 16px; width: 40%;">SYS.1 ID</th>
                        <th style="padding: 12px 16px; width: 60%;">SYS.2 IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of expandedResults[run.run_id] | slice:(getCurrentPage(run.run_id) - 1) * 3:getCurrentPage(run.run_id) * 3" style="border-top: 1px solid var(--border-color);">
                        <td style="padding: 16px; vertical-align: top;">
                          <a href="javascript:void(0)" (click)="openTraceDetails(row)" style="font-weight: 600; color: var(--color-primary); text-decoration: underline;">
                            {{ row.swe1_id || '-' }}
                          </a>
                        </td>
                        <td style="padding: 16px; vertical-align: top;">
                          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <a *ngFor="let swe2 of row.parsed_swe2_list" href="javascript:void(0)" (click)="openTraceDetails(row)" style="font-weight: 600; color: #0f766e; text-decoration: underline;">
                              {{ swe2.id || '-' }}
                            </a>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Pagination Footer -->
                  <div class="pagination-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border-color); background: #f8fafc; font-size: 0.75rem; color: var(--text-secondary);">
                    <div>
                      Showing {{ (getCurrentPage(run.run_id) - 1) * 3 + 1 }}-{{ getMin((getCurrentPage(run.run_id) * 3), expandedResults[run.run_id].length) }} of {{ expandedResults[run.run_id].length }} items
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="icon-btn-minimal" [disabled]="getCurrentPage(run.run_id) === 1" (click)="setPage(run.run_id, getCurrentPage(run.run_id) - 1)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      <button class="icon-btn-minimal" [disabled]="getCurrentPage(run.run_id) === getTotalPages(run.run_id)" (click)="setPage(run.run_id, getCurrentPage(run.run_id) + 1)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Load More Button -->
      <div *ngIf="!isLoadingHistory && hasMoreHistory" style="text-align: center; margin-top: 24px; margin-bottom: 24px;">
        <button class="btn btn-primary" (click)="loadMoreHistory()" [disabled]="isLoadingMore" style="padding: 8px 24px;">
          {{ isLoadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
      
      <!-- Traceability Details Modal -->
      <div class="modal-overlay" *ngIf="showTraceModal" (click)="closeTraceDetails()">
        <div class="modal-content" style="max-width: 600px; padding: 24px;" (click)="$event.stopPropagation()">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">Traceability Links</h3>
            <button class="icon-btn-minimal" (click)="closeTraceDetails()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div *ngIf="traceModalData" style="display: flex; flex-direction: column; gap: 20px; max-height: 60vh; overflow-y: auto;">
            <div>
              <div style="font-weight: 700; color: #0369a1; margin-bottom: 8px; font-size: 0.9rem;">SYS.1: {{ traceModalData.swe1_id || '-' }}</div>
              
              <div *ngIf="traceModalData.swe1_id" style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-primary);">
                {{ traceModalData.swe1_text || '-' }}
              </div>
              <div *ngIf="!traceModalData.swe1_id" style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; color: #94a3b8; font-style: italic;">
                No requirement found (Orphaned in SYS.2)
              </div>
            </div>
            
            <div>
              <div style="font-weight: 700; color: #0f766e; margin-bottom: 8px; font-size: 0.9rem;">Linked SYS.2 Requirements</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <ng-container *ngIf="traceModalData.req_id">
                  <div *ngFor="let swe2 of traceModalData.parsed_swe2_list" style="background: #f0fdfa; padding: 12px; border-radius: 6px; border: 1px solid #ccfbf1;">
                    <div style="font-weight: 600; color: #0f766e; font-size: 0.8rem; margin-bottom: 4px;">{{ swe2.id || '-' }}</div>
                    <div style="font-size: 0.85rem; color: var(--text-primary);">{{ swe2.text || '-' }}</div>
                  </div>
                </ng-container>
                
                <div *ngIf="!traceModalData.req_id" style="background: #f0fdfa; padding: 12px; border-radius: 6px; border: 1px solid #ccfbf1;">
                  <span style="color: #94a3b8; font-style: italic; font-size: 0.85rem;">No requirement found (Orphaned in SYS.1)</span>
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
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 16px 0;
      line-height: 1;
    }
    .metric-footer {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
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
    .icon-btn-minimal:hover:not(:disabled) {
      color: var(--text-primary);
      background-color: #f1f5f9;
    }
    .icon-btn-minimal:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .text-danger:hover:not(:disabled) {
      background-color: #fee2e2;
    }
    .no-runs {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }
    .minimized-shelf {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .modal-overlay {
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
    
    .modal-content {
      background: var(--bg-card);
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .history-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      background-color: var(--bg-card);
      transition: var(--transition);
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .history-card.minimized {
      padding: 16px 20px;
    }
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .history-body {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .spinner {
      display: inline-block;
      width: 28px;
      height: 28px;
      border: 3px solid rgba(0, 82, 204, 0.2);
      border-radius: 50%;
      border-top-color: var(--color-primary);
      animation: spin 1s linear infinite;
      margin-bottom: 12px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  @Output() viewRun = new EventEmitter<string>();
  @Output() newExecution = new EventEmitter<void>();
  
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
  currentOffset: number = 0;
  hasMoreHistory: boolean = true;
  isLoadingMore: boolean = false;

  // Filter State
  showFilterPanel: boolean = false;
  filterStatus: string = 'all';
  filterType: string = 'all';
  filterDate: string = 'all';
  
  showTraceModal: boolean = false;
  traceModalData: any = null;

  openTraceDetails(row: any) {
    this.traceModalData = row;
    this.showTraceModal = true;
  }

  closeTraceDetails() {
    this.showTraceModal = false;
    this.traceModalData = null;
  }

  getParsedSwe2List(row: any): any[] {
    if (!row.req_id || row.req_id === '-' || row.req_id.trim() === '') {
      return [{ id: '-', text: row.input_req || '-' }];
    }
    
    const ids = row.req_id.split(',').map((id: string) => id.trim());
    const texts = row.input_req ? row.input_req.split('\n').map((t: string) => t.trim()) : [];
    
    const parsedList = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let text = '-';
      
      const prefix = `• ${id}:`;
      const match = texts.find((t: string) => t.startsWith(prefix));
      if (match) {
        text = match.substring(prefix.length).trim();
      } else if (texts[i]) {
        text = texts[i].replace(/^•\s*[A-Za-z0-9_\-\.]+:\s*/, '').trim();
      }
      
      parsedList.push({ id, text });
    }
    
    return parsedList.length > 0 ? parsedList : [{ id: '-', text: row.input_req || '-' }];
  }

  get filteredHistory(): any[] {
    return this.history.filter(run => {
      // 1. Status Filter
      if (this.filterStatus !== 'all') {
        if (this.filterStatus === 'running' && run.status !== 'running' && run.status !== 'paused') return false;
        if (this.filterStatus === 'completed' && run.status !== 'completed') return false;
        if (this.filterStatus === 'stopped' && run.status !== 'stopped' && run.status !== 'failed') return false;
      }
      
      // 2. Type Filter
      if (this.filterType !== 'all') {
        if (run.type !== this.filterType) return false;
      }
      
      // 3. Date Filter
      if (this.filterDate !== 'all') {
        const runDate = new Date(run.timestamp);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - runDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (this.filterDate === 'today' && diffDays > 1) return false;
        if (this.filterDate === 'week' && diffDays > 7) return false;
        if (this.filterDate === 'month' && diffDays > 30) return false;
      }
      
      return true;
    });
  }

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef, private eRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (this.showFilterPanel) {
      const clickedInside = this.eRef.nativeElement.querySelector('.runs-history-header')?.contains(event.target);
      if (!clickedInside) {
        this.showFilterPanel = false;
        this.cdr.detectChanges();
      }
    }
  }

  toggleFilterPanel(event: Event) {
    this.showFilterPanel = !this.showFilterPanel;
    event.stopPropagation();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.isLoadingHistory = true;
    this.currentOffset = 0;
    this.hasMoreHistory = true;
    this.apiService.getHistory(15, 0).subscribe({
      next: (res) => {
        this.history = res;
        this.isLoadingHistory = false;
        if (res.length < 15) this.hasMoreHistory = false;
        this.calculatePassRate();
        
        // Pre-fetch results for any already expanded cards
        this.history.forEach(run => {
          if (run.minimized !== 1) {
            this.apiService.getRunResults(run.run_id).subscribe(details => {
              if (run.type === 'traceability') {
                details.forEach((r: any) => r.parsed_swe2_list = this.getParsedSwe2List(r));
              }
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

  loadMoreHistory() {
    if (this.isLoadingMore || !this.hasMoreHistory) return;
    this.isLoadingMore = true;
    this.currentOffset += 15;
    this.apiService.getHistory(15, this.currentOffset).subscribe({
      next: (res) => {
        this.history = [...this.history, ...res];
        this.isLoadingMore = false;
        if (res.length < 15) this.hasMoreHistory = false;
        this.calculatePassRate();
        
        // Pre-fetch results for any already expanded cards
        res.forEach(run => {
          if (run.minimized !== 1) {
            this.apiService.getRunResults(run.run_id).subscribe(details => {
              if (run.type === 'traceability') {
                details.forEach((r: any) => r.parsed_swe2_list = this.getParsedSwe2List(r));
              }
              this.expandedResults[run.run_id] = details;
              this.cdr.detectChanges();
            });
          }
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingMore = false;
        this.cdr.detectChanges();
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
    const run = this.history.find(r => r.run_id === runId);
    if (run) {
      run.minimized = currentlyMinimized ? 0 : 1;
    }

    this.apiService.minimizeRun(runId, !currentlyMinimized).subscribe(() => {
      if (currentlyMinimized) { // was minimized, now expanding
        this.apiService.getRunResults(runId).subscribe(res => {
          const runType = this.history.find(r => r.run_id === runId)?.type;
          if (runType === 'traceability') {
            res.forEach((r: any) => r.parsed_swe2_list = this.getParsedSwe2List(r));
          }
          this.expandedResults[runId] = res;
          this.currentPage[runId] = 1;
          this.cdr.detectChanges();
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
    return Math.ceil(total / 3) || 1;
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
