import { Component, OnInit, OnDestroy, Input, HostListener, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-requirements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="req-container">
      <div style="margin-bottom: 24px;">
        <h2 class="section-title" style="margin-bottom: 4px;">Requirement Evaluation Workspace</h2>
        <p class="section-desc">Upload requirements and evaluate them against standards.</p>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-title" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 20px;">
          Workspace Setup
        </div>
        
        <div class="grid grid-2" style="align-items: stretch; gap: 24px;">
          <!-- Left Configuration: Upload fields -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; gap: 16px;">
              <div style="flex: 1;">
                <label class="form-label">SYS 1 / HLR Document <span style="font-weight: normal; color: var(--color-primary);">*</span></label>
                <div class="dropzone" [class.has-file]="swe1File" style="height: 100px; padding: 16px; position: relative;">
                  <button *ngIf="swe1File" (click)="removeFile($event, 'swe1')" title="Remove file" style="position: absolute; top: 6px; right: 6px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; padding: 0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                  <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;" (click)="swe1Input.click()">
                    <div class="dropzone-icon" style="margin-bottom: 8px;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                    </div>
                    <div class="dropzone-text" style="font-size: 0.8rem; text-align: center; word-break: break-all;">{{ swe1File ? swe1File.name : 'Click to upload CSV/XLSX' }}</div>
                  </div>
                  <input #swe1Input type="file" (change)="onFileSelected($event, 'swe1')" style="display: none;" accept=".csv,.xlsx">
                </div>
              </div>

              <div style="flex: 1;">
                <label class="form-label">SYS 2 / LLR Document <span style="font-weight: normal; color: var(--text-secondary);">(Optional)</span></label>
                <div class="dropzone" [class.has-file]="swe2File" style="height: 100px; padding: 16px; position: relative;">
                  <button *ngIf="swe2File" (click)="removeFile($event, 'swe2')" title="Remove file" style="position: absolute; top: 6px; right: 6px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; padding: 0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                  <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;" (click)="swe2Input.click()">
                    <div class="dropzone-icon" style="margin-bottom: 8px;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                    </div>
                    <div class="dropzone-text" style="font-size: 0.8rem; text-align: center; word-break: break-all;">{{ swe2File ? swe2File.name : 'Click to upload CSV/XLSX' }}</div>
                  </div>
                  <input #swe2Input type="file" (change)="onFileSelected($event, 'swe2')" style="display: none;" accept=".csv,.xlsx">
                </div>
              </div>
            </div>

            <!-- Analysis Model selector -->
            <div class="form-group">
              <label class="form-label">Analysis Model</label>
              <select [(ngModel)]="selectedAnalysisModel" style="width: 100%;">
                <option value="nvidia/llama-3.3-nemotron-super-49b-v1.5">Llama 3.3 Nemotron 49B (NVIDIA)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Select Analysis Actions</label>
              <div class="checkbox-group" style="display: flex; gap: 16px; flex-wrap: wrap;">
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.analyse" [disabled]="actions.correct"> Quality Analysis
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correct" (ngModelChange)="onCorrectionToggle($event)"> Quality Correction
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.trace"> Traceability Analysis (SYS.2 to SYS.1)
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correctTrace"> Traceability Correction
                </label>
              </div>
            </div>
          </div>

          <!-- Right Configuration: Actions & Settings -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Mode</label>
              <div class="segmented-control">
                <div class="segment" [class.active]="rulesMode === 'strict'" (click)="rulesMode = 'strict'">Strict Rules</div>
                <div class="segment" [class.active]="rulesMode === 'rag'" (click)="rulesMode = 'rag'">RAG Engine</div>
                <div class="segment" [class.active]="rulesMode === 'custom'" (click)="rulesMode = 'custom'">Custom LLM</div>
              </div>
            </div>

            <div *ngIf="rulesMode === 'custom'" style="margin-top: -8px; margin-bottom: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" (click)="openCustomContextModal()" style="width: 100%;">
                ⚙️ Configure Custom Context
              </button>
            </div>

            <!-- Guidelines File Selector if strict is chosen -->
            <div class="form-group" *ngIf="rulesMode === 'strict'">
              <label class="form-label">Strict Guidelines Reference</label>
              <div style="display: flex; gap: 8px; align-items: stretch; position: relative;">
                
                <!-- Custom Multi-select Dropdown -->
                <div class="custom-dropdown" style="flex: 1; position: relative;">
                  <!-- Dropdown Toggle Button -->
                  <div class="dropdown-toggle" (click)="toggleDropdown()" style="display: flex; justify-content: space-between; align-items: center; min-height: 38px; border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.85rem; user-select: none;">
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
                      <span style="flex: 1;">{{ g.name }}</span>
                      <button type="button" (click)="deleteGuideline(g.id, $event)" style="background: none; border: none; cursor: pointer; padding: 4px; color: #ef4444; opacity: 0.7; font-size: 1rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.opacity=1; this.style.transform='scale(1.1)';" onmouseout="this.style.opacity=0.7; this.style.transform='scale(1)';" title="Delete Guideline">
                        ✕
                      </button>
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
            <div class="form-group" *ngIf="rulesMode === 'rag'">
              <label class="form-label">RAG Embedding Model</label>
              <select [(ngModel)]="selectedEmbedModel" style="width: 100%;">
                <option value="nvidia/embeddings-nv-embed-qa-4">nv-embed-qa-4 (NVIDIA)</option>
              </select>
            </div>
            
            <div style="flex-grow: 1;"></div>
            
            <div class="execution-controls" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
              <div class="btn-group" style="display: flex; gap: 8px;">
                <button class="btn btn-primary" (click)="startRun()" *ngIf="!isRunning" [disabled]="!swe1File && !swe2File" style="flex: 1;">
                  🚀 Start Execution
                </button>
                <button class="btn btn-warning" (click)="pauseRun()" *ngIf="isRunning && !isPaused" style="flex: 1;">
                  ⏸️ Pause
                </button>
                <button class="btn btn-success" (click)="resumeRun()" *ngIf="isRunning && isPaused" style="flex: 1;">
                  ▶️ Resume
                </button>
                <button class="btn btn-danger" (click)="stopRun()" *ngIf="isRunning" style="flex: 1;">
                  🛑 Stop
                </button>
              </div>

              <div *ngIf="isRunning || isFinished" class="progress-bar-container" style="margin-top: 16px;">
                <div class="progress-meta" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 6px;">
                  <span>Run ID: <code style="color: var(--text-primary);">{{ activeRunId }}</code></span>
                  <span *ngIf="isRunning">Processing Row: {{ currentRow }}/{{ totalRows }}</span>
                  <span *ngIf="isFinished">Run Status: <strong style="color: var(--text-primary);">{{ runStatus | uppercase }}</strong></span>
                </div>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                  <div [class.bg-running]="runStatus === 'running'" [class.bg-paused]="runStatus === 'paused'" [style.width.%]="getProgressPercent()" style="height: 100%; transition: width 0.2s ease-in-out;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Results Datatable -->
      <div class="card" *ngIf="results.length > 0" style="padding: 0;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="font-weight: 600; font-size: 1.05rem;">📋 Analysis Matrix Results</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" (click)="clearResults()">🧹 Clear Results</button>
            <button class="btn btn-secondary btn-sm" (click)="exportResults()">📥 Export CSV</button>
          </div>
        </div>
        
        <div style="padding: 0 24px;">
          <div class="tabs-nav">
            <button class="tab-btn" [class.active]="activeTab === 'sys1'" (click)="activeTab = 'sys1'; currentPage = 1" *ngIf="!isTraceabilityRun && hasCategory('sys1')">SYS 1 Quality</button>
            <button class="tab-btn" [class.active]="activeTab === 'sys2'" (click)="activeTab = 'sys2'; currentPage = 1" *ngIf="!isTraceabilityRun && hasCategory('sys2')">SYS 2 Quality</button>
            <button class="tab-btn" [class.active]="activeTab === 'traceability'" (click)="activeTab = 'traceability'; currentPage = 1" *ngIf="isTraceabilityRun || hasCategory('traceability')">Traceability</button>
          </div>
        </div>
        
        <div class="table-container" style="padding: 0 24px 24px 24px; border: none; border-radius: 0;">
          <table>
            <thead>
              <tr *ngIf="!isTraceabilityRun">
                <th>ID</th>
                <th>Requirement</th>
                <th>Status</th>
                <th>Violated Rule</th>
                <th>Rationale / Reasoning</th>
                <th *ngIf="hasCorrections()">Corrected Requirement</th>
              </tr>
              <tr *ngIf="isTraceabilityRun">
                <th>SYS.1 ID</th>
                <th>SYS.1 Requirement</th>
                <th>SYS.2 ID</th>
                <th>SYS.2 Requirement</th>
                <th>Status</th>
                <th>Rationale / Reasoning</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let row of filteredResults | slice:(currentPage - 1) * pageSize : currentPage * pageSize">
                <!-- Quality Analysis View -->
                <!-- Quality Analysis View -->
                <ng-container *ngIf="!isTraceabilityRun">
                  <!-- Split Requirement / Corrections View -->
                  <ng-container *ngIf="hasCorrections() && splitCorrectedReq(row.corrected_req).length > 1; else singleRowView">
                    <tr *ngFor="let req of splitCorrectedReq(row.corrected_req); let i = index">
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="font-weight: 600; white-space: nowrap; vertical-align: top;">{{ row.req_id }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="max-width: 300px; vertical-align: top;">{{ row.input_req }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="vertical-align: top;">
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </span>
                      </td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="font-weight: 500; font-family: monospace; vertical-align: top;">{{ row.failed_rule || 'N/A' }}</td>
                      <td *ngIf="i === 0" [attr.rowspan]="splitCorrectedReq(row.corrected_req).length" style="color: var(--text-secondary); font-size: 0.8rem; vertical-align: top;">{{ row.rationale }}</td>
                      <td style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-bottom: 1px solid #e2e8f0; border-left: 3px solid #cbd5e1; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; vertical-align: middle;">
                        <span style="color: var(--color-primary); font-weight: 600; margin-right: 6px;">{{i + 1}}.</span>{{ req }}
                      </td>
                    </tr>
                  </ng-container>

                  <!-- Standard Single Row view -->
                  <ng-template #singleRowView>
                    <tr>
                      <td style="font-weight: 600; white-space: nowrap;">{{ row.req_id }}</td>
                      <td style="max-width: 300px;">{{ row.input_req }}</td>
                      <td>
                        <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                          {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                        </span>
                      </td>
                      <td style="font-weight: 500; font-family: monospace;">{{ row.failed_rule || 'N/A' }}</td>
                      <td style="color: var(--text-secondary); font-size: 0.8rem;">{{ row.rationale }}</td>
                      <td *ngIf="hasCorrections()" style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; padding-left: 10px; padding-top: 10px; padding-bottom: 10px;">
                        {{ row.corrected_req || '-' }}
                      </td>
                    </tr>
                  </ng-template>
                </ng-container>
                
                <!-- Traceability Matrix View -->
                <ng-container *ngIf="isTraceabilityRun">
                  <tr *ngFor="let swe2 of row.parsed_swe2_list; let i = index">
                    <td *ngIf="i === 0" [attr.rowspan]="row.parsed_swe2_list.length" style="font-weight: 600; white-space: nowrap; color: #0369a1; border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.swe1_id || '-' }}</td>
                    <td *ngIf="i === 0" [attr.rowspan]="row.parsed_swe2_list.length" style="max-width: 250px; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.swe1_text || '-' }}</td>
                    <td style="font-weight: 600; max-width: 150px; font-size: 0.85rem; white-space: pre-wrap; color: #15803d; border-bottom: 1px solid var(--border-color);">{{ swe2.id }}</td>
                    <td style="max-width: 350px; font-size: 0.85rem; white-space: pre-wrap; border-bottom: 1px solid var(--border-color);">{{ swe2.text }}</td>
                    <td *ngIf="i === 0" [attr.rowspan]="row.parsed_swe2_list.length" style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                      <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                        {{ row.status }}
                      </span>
                    </td>
                    <td *ngIf="i === 0" [attr.rowspan]="row.parsed_swe2_list.length" style="color: var(--text-secondary); font-size: 0.8rem; border-bottom: 1px solid var(--border-color); vertical-align: middle;">{{ row.rationale }}</td>
                  </tr>
                </ng-container>
              </ng-container>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Footer -->
        <div *ngIf="filteredResults.length > pageSize" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-secondary); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
          <div>
            Showing <strong style="color: var(--text-primary);">{{ (currentPage - 1) * pageSize + 1 }}</strong> - <strong style="color: var(--text-primary);">{{ getMin(currentPage * pageSize, filteredResults.length) }}</strong> of <strong style="color: var(--text-primary);">{{ filteredResults.length }}</strong> requirements
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)" style="padding: 4px 12px;">
              ‹ Prev
            </button>
            <span style="font-weight: 500; color: var(--text-primary);">Page {{ currentPage }} of {{ getTotalPages() }}</span>
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage === getTotalPages()" (click)="setPage(currentPage + 1)" style="padding: 4px 12px;">
              Next ›
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Standards Setup Upload Modal -->
    <div class="modal-backdrop" *ngIf="showUploadModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0;">🔧 Manage & Upload Standards Guidelines</h3>
          <button type="button" class="modal-close" (click)="closeUploadModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="tabs-nav" style="margin-top: 0; margin-bottom: 20px;">
            <button class="tab-btn" [class.active]="activeModalTab === 'upload'" (click)="activeModalTab = 'upload'">📤 Upload New</button>
            <button class="tab-btn" [class.active]="activeModalTab === 'manage'" (click)="activeModalTab = 'manage'">📋 Available Rules</button>
          </div>

          <ng-container *ngIf="activeModalTab === 'upload'">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
              Configure strict standard documents in JSON format (e.g. INCOSE rules list, ASPICE guidelines) to enable validation.
            </p>

            <div class="form-group">
              <label class="form-label">Standards Document Name (e.g. INCOSE Rules, ASPICE SWE.1)</label>
              <input type="text" [(ngModel)]="newStandardName" placeholder="Enter name..." style="width: 100%;">
            </div>

            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label">Upload JSON Guidelines File</label>
              <div class="dropzone" (click)="stdInput.click()" [class.has-file]="standardFile" style="height: 100px; padding: 16px;">
                <div class="dropzone-icon" style="margin-bottom: 8px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                </div>
                <div class="dropzone-text" style="font-size: 0.8rem;">{{ standardFile ? standardFile.name : 'Choose JSON Guidelines File' }}</div>
                <input #stdInput type="file" (change)="onStandardFileSelected($event)" style="display: none;" accept=".json">
              </div>
            </div>

            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" (click)="closeUploadModal()">Cancel</button>
              <button 
                type="button"
                class="btn btn-primary" 
                [disabled]="!newStandardName || !standardFile || isUploadingStandard" 
                (click)="uploadStandard()">
                {{ isUploadingStandard ? 'Uploading...' : 'Upload Standards Document' }}
              </button>
            </div>

            <div *ngIf="uploadedStatus" class="alert alert-success" style="margin-top: 16px; padding: 12px; background: #e6f4ea; color: var(--color-success); border-radius: 6px; font-size: 0.85rem;">
              {{ uploadedStatus }}
            </div>
          </ng-container>

          <ng-container *ngIf="activeModalTab === 'manage'">
            <div style="max-height: 450px; overflow-y: auto; padding-right: 8px;">
              <div *ngFor="let g of guidelines" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #f8fafc;">
                
                <!-- Display Mode -->
                <ng-container *ngIf="editingGuidelineId !== g.id">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <h4 style="margin: 0 0 4px 0; font-size: 1rem; color: var(--text-primary);">{{ g.name }}</h4>
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: {{ g.id }}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="btn btn-secondary btn-sm" (click)="downloadGuideline(g)" title="Download JSON" style="padding: 4px 8px;">
                        ⬇️
                      </button>
                      <button class="btn btn-secondary btn-sm" (click)="editGuideline(g)" title="Edit" style="padding: 4px 8px;">
                        ✏️
                      </button>
                      <button class="btn btn-secondary btn-sm" (click)="deleteGuideline(g.id, $event)" title="Delete" style="color: #ef4444; padding: 4px 8px;">
                        ✕
                      </button>
                    </div>
                  </div>
                </ng-container>

                <!-- Edit Mode -->
                <ng-container *ngIf="editingGuidelineId === g.id">
                  <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="font-size: 0.8rem;">Rule Name</label>
                    <input type="text" [(ngModel)]="editingGuidelineName" style="width: 100%; padding: 6px;">
                  </div>
                  <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="font-size: 0.8rem;">JSON Content</label>
                    <textarea [(ngModel)]="editingGuidelineContent" rows="12" style="width: 100%; border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; font-family: monospace; font-size: 0.8rem; resize: vertical; line-height: 1.4;"></textarea>
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" (click)="cancelEdit()">Cancel</button>
                    <button class="btn btn-primary btn-sm" (click)="saveEditedGuideline()">Save Changes</button>
                  </div>
                </ng-container>
              </div>
              
              <div *ngIf="guidelines.length === 0" style="text-align: center; color: var(--text-secondary); padding: 24px; font-size: 0.9rem;">
                No guidelines uploaded yet.
              </div>
            </div>
          </ng-container>
        </div>
      </div>
    </div>

    <!-- Custom LLM Context Setup Modal -->
    <div class="modal-backdrop" *ngIf="showCustomContextModal">
      <div class="modal-card" style="width: 650px; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="flex-shrink: 0;">
          <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0;">⚙️ Configure Custom LLM Context</h3>
          <button type="button" class="modal-close" (click)="closeCustomContextModal()">✕</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 24px; overflow-y: auto; flex: 1;">
          
          <!-- Simple Tab Switcher (Only visible if Quality Correction is enabled) -->
          <div *ngIf="actions.correct" style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); margin-bottom: 8px;">
            <button type="button" (click)="activeConfigTab = 'analysis'" [style.border-bottom]="activeConfigTab === 'analysis' ? '2px solid var(--color-primary)' : 'none'" [style.color]="activeConfigTab === 'analysis' ? 'var(--color-primary)' : 'var(--text-secondary)'" style="background: none; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem; outline: none;">🔍 Auditor Config</button>
            <button type="button" (click)="activeConfigTab = 'correction'" [style.border-bottom]="activeConfigTab === 'correction' ? '2px solid var(--color-primary)' : 'none'" [style.color]="activeConfigTab === 'correction' ? 'var(--text-secondary)' : 'var(--text-secondary)'" style="background: none; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem; outline: none;">🛠️ Corrector Config</button>
          </div>

          <!-- Tab 1: Analysis Auditor Config -->
          <ng-container *ngIf="activeConfigTab === 'analysis'">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px; margin-top: 0;">
              Define your custom validation rules. This block is injected into the LLM system prompt for the Quality Auditor.
            </p>

            <!-- 1. Header (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">System Persona (Read-only Header)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptHeader }}</div>
            </div>

            <!-- 2. Custom Criteria (Editable) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--color-primary);">Custom Audit Rules (Editable Context)</label>
              <textarea [(ngModel)]="customContextText" rows="4" placeholder="Write your custom validation rules here..." style="width: 100%; border: 1px solid var(--color-primary); border-radius: 6px; padding: 12px; font-size: 0.85rem; font-family: inherit; resize: vertical; outline: none; box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.1);"></textarea>
            </div>

            <!-- 3. Footer (Read-only) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Output Format Constraint (Read-only Footer)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptFooter }}</div>
            </div>
          </ng-container>

          <!-- Tab 2: Correction Corrector Config -->
          <ng-container *ngIf="activeConfigTab === 'correction' && actions.correct">
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px; margin-top: 0;">
              Define your custom instructions for rewriting requirements. This block is injected into the LLM system prompt for the Quality Corrector.
            </p>

            <!-- 1. Header (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Corrector Persona (Read-only Header)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptHeaderCorrection }}</div>
            </div>

            <!-- 2. Custom Criteria (Editable) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--color-primary);">Custom Correction Rules (Editable Context)</label>
              <textarea [(ngModel)]="customContextCorrectionText" rows="4" placeholder="Write your custom rewriting/correction guidelines here..." style="width: 100%; border: 1px solid var(--color-primary); border-radius: 6px; padding: 12px; font-size: 0.85rem; font-family: inherit; resize: vertical; outline: none; box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.1);"></textarea>
            </div>

            <!-- 3. Footer (Read-only) -->
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Output Format Constraint (Read-only Footer)</label>
              <div style="background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 0.75rem; color: #64748b; max-height: 80px; overflow-y: auto; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; line-height: 1.4;">{{ fixedPromptFooterCorrection }}</div>
            </div>
          </ng-container>

          <div style="display: flex; gap: 12px; margin-top: 16px; flex-shrink: 0; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" (click)="closeCustomContextModal()">Cancel</button>
            <button type="button" class="btn btn-primary" (click)="saveCustomContext()">Save Configurations</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkbox-lbl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--text-primary);
    }
    .segmented-control {
      display: flex;
      background-color: #f1f5f9;
      padding: 4px;
      border-radius: 8px;
      width: 100%;
    }
    .segment {
      flex: 1;
      text-align: center;
      padding: 8px 12px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      transition: var(--transition);
      user-select: none;
    }
    .segment.active {
      background-color: #fff;
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .segment:not(.active):hover {
      color: var(--text-primary);
    }
    .tabs-nav {
      display: flex;
      gap: 24px;
      border-bottom: 2px solid var(--border-color);
      margin-top: 16px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      padding: 12px 0;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      position: relative;
    }
    .tab-btn.active {
      color: var(--color-primary);
    }
    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 2px;
      background-color: var(--color-primary);
      border-radius: 2px 2px 0 0;
    }
    .tab-btn:hover:not(.active) {
      color: var(--text-primary);
    }
    
    .bg-running { background-color: var(--color-primary); }
    .bg-paused { background-color: var(--color-warning); }

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
    
    .modal-close {
      background: transparent;
      border: none;
      font-size: 1.2rem;
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

    .dropdown-item {
      background-color: transparent;
      transition: background-color 0.2s ease;
    }
    .dropdown-item:hover {
      background-color: #f1f3f5;
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
export class RequirementsComponent implements OnInit, OnDestroy {
  swe1File: File | null = null;
  swe2File: File | null = null;
  
  actions = {
    analyse: true,
    correct: false,
    trace: false,
    correctTrace: false
  };

  rulesMode: 'strict' | 'rag' | 'custom' = 'strict';
  guidelines: any[] = [];
  selectedGuidelineIds: string[] = [];
  showDropdown = false;
  
  // Manage Guidelines Modal State
  activeModalTab: 'upload' | 'manage' = 'upload';
  editingGuidelineId: string | null = null;
  editingGuidelineName: string = '';
  editingGuidelineContent: string = '';
  
  // Custom LLM Context configurations
  showCustomContextModal = false;
  activeConfigTab: 'analysis' | 'correction' = 'analysis';
  customContextText = '1. The requirement must be written clearly.\n2. Do not use complex compound sentences.\n3. The statement must explicitly define an automotive subsystem name.';
  customContextCorrectionText = '1. Rewrite requirement to be clear and single-focused.\n2. Maintain EARS syntax pattern.\n3. Ensure all numbers use explicitly defined metric units.';
  
  fixedPromptHeader = `You are a strict, deterministic Systems Engineering Requirements Auditor.
Your task is to analyze an engineering requirement using INCOSE guidelines and EARS syntax.
You MUST:
- Identify structural components (trigger, condition, system response)
- Evaluate compliance against INCOSE guidelines, EARS syntax`;

  fixedPromptFooter = `Rules for Output:
1. Return ONLY valid JSON exactly matching the schema below.
2. Do NOT include any explanation or markdown formatting outside the JSON.
3. Do NOT invent information. Output must be perfectly reproducible.

JSON Schema:
{
  "status": "Passed" or "Review",
  "failed_rules": ["Rule name 1", "Rule name 2", ...] or [],
  "rationale": "Concise structured explanation"
}`;

  fixedPromptHeaderCorrection = `You are a strict, deterministic Senior Systems Engineer and Requirements Expert.
Your task is to analyze and correct engineering requirements using INCOSE guidelines and EARS syntax.
You MUST:
- Split the requirement if it contains multiple actions
- Clean up any grammatical or structural issues`;

  fixedPromptFooterCorrection = `Rules for Output:
1. Return ONLY valid JSON exactly matching the schema below.
2. Do NOT include any explanation or markdown formatting outside the JSON.
3. Do NOT invent information. Output must be perfectly reproducible.

JSON Schema:
{
  "split_required": boolean,
  "corrected_requirements": [string]
}`;
  
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
  
  // Pagination
  currentPage = 1;
  pageSize = 15;
  
  isTraceabilityRun = false;
  
  // Tab state for output table
  activeTab: 'sys1' | 'sys2' | 'traceability' = 'sys1';
  
  private timerSubscription: any;

  constructor(private apiService: ApiService, private elementRef: ElementRef, private cdr: ChangeDetectorRef) {}

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
      // Auto-populate the name field from filename (without extension)
      if (!this.newStandardName || this.newStandardName.trim() === '') {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        this.newStandardName = nameWithoutExt;
      }
    }
  }

  openCustomContextModal() {
    this.showCustomContextModal = true;
    if (!this.actions.correct) {
      this.activeConfigTab = 'analysis';
    }
  }

  closeCustomContextModal() {
    this.showCustomContextModal = false;
  }

  saveCustomContext() {
    this.showCustomContextModal = false;
    this.cdr.detectChanges();
  }

  deleteGuideline(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this strict guideline file?')) {
      this.apiService.deleteGuideline(id).subscribe({
        next: () => {
          this.selectedGuidelineIds = this.selectedGuidelineIds.filter(gId => gId !== id);
          this.loadGuidelines();
        },
        error: (err) => {
          alert('Failed to delete guideline: ' + (err.error?.detail || err.message));
        }
      });
    }
  }

  downloadGuideline(g: any) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(g.content, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", g.name + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  editGuideline(g: any) {
    this.editingGuidelineId = g.id;
    this.editingGuidelineName = g.name;
    this.editingGuidelineContent = JSON.stringify(g.content, null, 2);
  }

  cancelEdit() {
    this.editingGuidelineId = null;
    this.editingGuidelineName = '';
    this.editingGuidelineContent = '';
  }

  saveEditedGuideline() {
    if (!this.editingGuidelineId || !this.editingGuidelineName.trim() || !this.editingGuidelineContent.trim()) {
      alert("Name and Content cannot be empty.");
      return;
    }
    
    // Validate JSON
    try {
      JSON.parse(this.editingGuidelineContent);
    } catch (e) {
      alert("Invalid JSON content. Please ensure the rules are valid JSON format.");
      return;
    }

    this.apiService.updateGuideline(this.editingGuidelineId, this.editingGuidelineName, this.editingGuidelineContent).subscribe({
      next: () => {
        this.loadGuidelines();
        this.cancelEdit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Failed to update guideline: ' + (err.error?.detail || err.message));
      }
    });
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isUploadingStandard = false;
        this.cdr.detectChanges();
        alert('Failed to upload guidelines: ' + (err.error?.detail || err.message));
      }
    });
  }

  loadGuidelines() {
    this.apiService.getGuidelines().subscribe({
      next: (res) => {
        this.guidelines = res;
        this.cdr.detectChanges();
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

  removeFile(event: Event, type: 'swe1' | 'swe2') {
    event.stopPropagation();
    if (type === 'swe1') {
      this.swe1File = null;
    } else {
      this.swe2File = null;
    }
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

  onCorrectionToggle(checked: boolean) {
    if (checked) {
      // Correction requires analysis — auto-enable it
      this.actions.analyse = true;
    }
  }

  startRun() {
    if ((this.actions.analyse || this.actions.correct) && this.rulesMode === 'strict' && this.selectedGuidelineIds.length === 0) {
      alert('⚠️ Please select at least one strict guideline document from the dropdown before starting execution.');
      return;
    }

    if ((this.actions.trace || this.actions.correctTrace) && (!this.swe1File || !this.swe2File)) {
      alert('⚠️ Both SYS 1 and SYS 2 documents must be uploaded for traceability analysis.');
      return;
    }

    let runType = 'quality';
    if (this.actions.trace || this.actions.correctTrace) {
      runType = 'traceability';
      this.isTraceabilityRun = true;
      this.activeTab = 'traceability';
    } else {
      this.isTraceabilityRun = false;
      this.activeTab = 'sys1';
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.isFinished = false;
    this.runStatus = 'running';
    this.results = [];
    this.currentPage = 1;
    this.currentRow = 0;
    this.totalRows = 0;
    this.activeRunId = 'Initializing...';
 
    const useRagBool = this.rulesMode === 'rag';
    const customPromptVal = this.rulesMode === 'custom' ? this.customContextText : undefined;
    const customPromptCorrectionVal = this.rulesMode === 'custom' ? this.customContextCorrectionText : undefined;

    this.apiService.startAnalysis(
      runType,
      this.rulesMode === 'strict' ? (this.selectedGuidelineIds.join(',') || null) : null,
      useRagBool,
      this.selectedAnalysisModel,
      this.swe1File || undefined,
      this.swe2File || undefined,
      this.actions.correct,
      this.actions.correctTrace,
      customPromptVal,
      customPromptCorrectionVal
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
              this.results = res.map((r: any) => {
                if (this.isTraceabilityRun && !r.parsed_swe2_list) {
                  r.parsed_swe2_list = this.getParsedSwe2List(r);
                }
                return r;
              });
              this.cdr.detectChanges();
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
          this.cdr.detectChanges();
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
    this.activeTab = this.isTraceabilityRun ? 'traceability' : 'sys1';
    this.currentPage = 1;
    
    this.apiService.getRunResults(runId).subscribe({
      next: (res) => {
        this.results = res.map((r: any) => {
          if (this.isTraceabilityRun && !r.parsed_swe2_list) {
            r.parsed_swe2_list = this.getParsedSwe2List(r);
          }
          return r;
        });
        this.cdr.detectChanges();
      }
    });
  }
  getParsedSwe2List(row: any): any[] {
    if (!row.req_id || row.req_id === '-' || row.req_id.trim() === '') {
      return [{ id: '-', text: row.input_req || '-' }];
    }
    
    const ids = row.req_id.split(',').map((id: string) => id.trim());
    
    // Attempt to parse input_req based on "• ID: text" format
    const texts = row.input_req ? row.input_req.split('\n').map((t: string) => t.trim()) : [];
    
    const parsedList = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let text = '-';
      
      // Try to find the matching text block by ID
      const prefix = `• ${id}:`;
      const match = texts.find((t: string) => t.startsWith(prefix));
      if (match) {
        text = match.substring(prefix.length).trim();
      } else if (texts[i]) {
        // Fallback: just use the line corresponding to the index
        text = texts[i].replace(/^•\s*[A-Za-z0-9_\-\.]+:\s*/, '').trim();
      }
      
      parsedList.push({ id, text });
    }
    
    return parsedList.length > 0 ? parsedList : [{ id: '-', text: row.input_req || '-' }];
  }



  getProgressPercent(): number {
    return this.totalRows > 0 ? (this.currentRow / this.totalRows) * 100 : 0;
  }

  get filteredResults(): any[] {
    if (this.isTraceabilityRun) {
      return this.results.filter(r => r.category === 'traceability' || r.category == null);
    }
    return this.results.filter(r => r.category === this.activeTab || (this.activeTab === 'sys1' && r.category == null));
  }

  hasCategory(category: string): boolean {
    if (category === 'sys1' && !this.isTraceabilityRun) {
      return this.results.some(r => r.category === category || r.category == null);
    }
    return this.results.some(r => r.category === category);
  }

  exportResults() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Input Requirement,Status,Rule/Trace Target,Rationale,Corrected Requirement\n";
    
    this.results.forEach(row => {
      const correctedReqs = this.splitCorrectedReq(row.corrected_req);
      
      if (correctedReqs.length > 1) {
        // If split, create multiple rows
        correctedReqs.forEach((reqText: string, idx: number) => {
          const splitId = `${row.req_id || ''}.${idx + 1}`;
          const inputReq = idx === 0 ? `"${(row.input_req || '').replace(/"/g, '""')}"` : '""';
          const status = idx === 0 ? row.status || '' : '""';
          const rule = idx === 0 ? row.failed_rule || 'N/A' : '""';
          const rationale = idx === 0 ? `"${(row.rationale || '').replace(/"/g, '""')}"` : '""';
          
          const line = [
            splitId,
            inputReq,
            status,
            rule,
            rationale,
            `"${reqText.replace(/"/g, '""')}"`
          ].join(",");
          csvContent += line + "\n";
        });
      } else {
        // Single row
        const line = [
          row.req_id || '',
          `"${(row.input_req || '').replace(/"/g, '""')}"`,
          row.status || '',
          row.failed_rule || 'N/A',
          `"${(row.rationale || '').replace(/"/g, '""')}"`,
          `"${(row.corrected_req || '').replace(/"/g, '""')}"`
        ].join(",");
        csvContent += line + "\n";
      }
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AIRAM_Run_${this.activeRunId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  hasCorrections(): boolean {
    if (!this.filteredResults || this.filteredResults.length === 0) return false;
    return this.filteredResults.some(row => row.corrected_req && row.corrected_req !== '-' && row.corrected_req.trim() !== '');
  }

  splitCorrectedReq(text: string): string[] {
    if (!text || text === '-') return [];
    return text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
  }

  // Pagination & Reset Methods
  getTotalPages(): number {
    return Math.ceil(this.filteredResults.length / this.pageSize) || 1;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
      this.cdr.detectChanges();
    }
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }



  clearResults() {
    this.results = [];
    this.activeRunId = '';
    this.runStatus = '';
    this.isFinished = false;
    this.currentRow = 0;
    this.totalRows = 0;
    this.currentPage = 1;
    this.cdr.detectChanges();
  }
}
