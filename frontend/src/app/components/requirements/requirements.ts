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
                  <input type="checkbox" [(ngModel)]="actions.analyse" [disabled]="actions.correct"> Quality Analysis
                </label>
                <label class="checkbox-lbl">
                  <input type="checkbox" [(ngModel)]="actions.correct" (ngModelChange)="onCorrectionToggle($event)"> Quality Correction
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
              <div class="radio-group" style="flex-wrap: wrap; gap: 12px; align-items: center;">
                <label class="radio-lbl">
                  <input type="radio" name="rule_mode" value="rag" [(ngModel)]="rulesMode"> RAG Engine Search
                </label>
                <label class="radio-lbl">
                  <input type="radio" name="rule_mode" value="strict" [(ngModel)]="rulesMode"> Strict Guidelines File
                </label>
                <label class="radio-lbl" style="display: flex; align-items: center; gap: 6px;">
                  <input type="radio" name="rule_mode" value="custom" [(ngModel)]="rulesMode"> Custom LLM Context
                  <button type="button" *ngIf="rulesMode === 'custom'" class="btn btn-secondary btn-sm" (click)="openCustomContextModal()" style="padding: 2px 8px; font-size: 0.75rem; height: auto; min-height: 24px; display: inline-flex; align-items: center; gap: 3px; border-radius: 4px;">
                    ⚙️ Configure
                  </button>
                </label>
              </div>
            </div>

            <!-- Guidelines File Selector if strict is chosen -->
            <div class="form-group" *ngIf="rulesMode === 'strict'" style="margin-top: 12px;">
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
                      <span style="flex: 1;">{{ g.name }}</span>
                      <button type="button" (click)="deleteGuideline(g.id, $event)" style="background: none; border: none; cursor: pointer; padding: 4px; color: #ef4444; opacity: 0.7; font-size: 1rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.opacity=1; this.style.transform='scale(1.1)';" onmouseout="this.style.opacity=0.7; this.style.transform='scale(1)';" title="Delete Guideline">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
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
            <div class="form-group" *ngIf="rulesMode === 'rag'" style="margin-top: 12px;">
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
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-warning btn-sm" (click)="clearResults()" style="background-color: #fff3cd; color: #856404; border-color: #ffeeba;">🧹 Clear Results</button>
            <button class="btn btn-secondary btn-sm" (click)="exportResults()">📥 Export CSV</button>
          </div>
        </div>
        
        <div class="table-container">
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
                <th>SWE.1 ID</th>
                <th>SWE.1 Requirement</th>
                <th>SWE.2 ID</th>
                <th>SWE.2 Requirement</th>
                <th>Status</th>
                <th>Rationale / Reasoning</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let row of results | slice:(currentPage - 1) * pageSize : currentPage * pageSize">
                <!-- Quality Analysis View -->
                <tr *ngIf="!isTraceabilityRun">
                  <td style="font-weight: 600; white-space: nowrap;">{{ row.req_id }}</td>
                  <td style="max-width: 300px;">{{ row.input_req }}</td>
                  <td>
                    <span class="badge" [class.badge-pass]="row.status === 'PASS'" [class.badge-review]="row.status === 'REVIEW' || row.status === 'FAIL'">
                      {{ row.status === 'FAIL' ? 'REVIEW' : row.status }}
                    </span>
                  </td>
                  <td style="font-weight: 500; font-family: monospace;">{{ row.failed_rule || 'N/A' }}</td>
                  <td style="color: var(--text-secondary); font-size: 0.8rem;">{{ row.rationale }}</td>
                  <td *ngIf="hasCorrections()" style="font-weight: 500; color: #1e293b; background-color: #fafafa; border-left: 3px solid #cbd5e1; padding-left: 10px;">
                    {{ row.corrected_req || '-' }}
                  </td>
                </tr>
                
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
        <div class="pagination-footer" *ngIf="results.length > pageSize" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background-color: #f8f9fa; border-top: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-secondary);">
          <div class="pagination-info">
            Showing <strong style="color: var(--text-primary);">{{ (currentPage - 1) * pageSize + 1 }}</strong> - <strong style="color: var(--text-primary);">{{ getMin(currentPage * pageSize, results.length) }}</strong> of <strong style="color: var(--text-primary);">{{ results.length }}</strong> requirements
          </div>
          <div class="pagination-controls" style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-sm btn-secondary pagination-btn" [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)" style="padding: 3px 10px; font-size: 0.75rem; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid var(--border-color); background-color: #fff; cursor: pointer;">
              ‹ Prev
            </button>
            <span class="pagination-indicator" style="font-weight: 500; color: var(--text-primary);">Page {{ currentPage }} of {{ getTotalPages() }}</span>
            <button class="btn btn-sm btn-secondary pagination-btn" [disabled]="currentPage === getTotalPages()" (click)="setPage(currentPage + 1)" style="padding: 3px 10px; font-size: 0.75rem; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid var(--border-color); background-color: #fff; cursor: pointer;">
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

    <!-- Custom LLM Context Setup Modal -->
    <div class="modal-backdrop" *ngIf="showCustomContextModal">
      <div class="modal-card" style="width: 650px; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="flex-shrink: 0;">
            <div class="modal-title">⚙️ Configure Custom LLM Context</div>
          <button type="button" class="btn-close" (click)="closeCustomContextModal()">✕</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 16px 24px; overflow-y: auto; flex: 1;">
          
          <!-- Simple Tab Switcher (Only visible if Quality Correction is enabled) -->
          <div *ngIf="actions.correct" style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); margin-bottom: 8px;">
            <button type="button" (click)="activeConfigTab = 'analysis'" [style.border-bottom]="activeConfigTab === 'analysis' ? '2px solid var(--color-primary)' : 'none'" [style.color]="activeConfigTab === 'analysis' ? 'var(--color-primary)' : 'var(--text-secondary)'" style="background: none; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem; outline: none;">🔍 Auditor Config</button>
            <button type="button" (click)="activeConfigTab = 'correction'" [style.border-bottom]="activeConfigTab === 'correction' ? '2px solid var(--color-primary)' : 'none'" [style.color]="activeConfigTab === 'correction' ? 'var(--color-primary)' : 'var(--text-secondary)'" style="background: none; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem; outline: none;">🛠️ Corrector Config</button>
          </div>

          <!-- Tab 1: Analysis Auditor Config -->
          <ng-container *ngIf="activeConfigTab === 'analysis'">
            <p class="section-desc" style="color: var(--text-secondary); font-size: 0.8rem; margin: 0;">
              Define your custom validation rules. This block is injected into the LLM system prompt for the Quality Auditor.
            </p>

            <!-- 1. Header (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">System Persona (Read-only Header)</label>
              <div style="background-color: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 0.7rem; color: #666; max-height: 60px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; line-height: 1.25;">{{ fixedPromptHeader }}</div>
            </div>

            <!-- 2. Custom Criteria (Editable) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.8rem; color: var(--color-primary);">Custom Audit Rules (Editable Context)</label>
              <textarea [(ngModel)]="customContextText" rows="3" placeholder="Write your custom validation rules here..." style="width: 100%; border: 1px solid var(--color-primary); border-radius: 6px; padding: 8px; font-size: 0.8rem; font-family: inherit; resize: vertical; outline: none;"></textarea>
            </div>

            <!-- 3. Footer (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Output Format Constraint (Read-only Footer)</label>
              <div style="background-color: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 0.7rem; color: #666; max-height: 60px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; line-height: 1.25;">{{ fixedPromptFooter }}</div>
            </div>
          </ng-container>

          <!-- Tab 2: Correction Corrector Config -->
          <ng-container *ngIf="activeConfigTab === 'correction' && actions.correct">
            <p class="section-desc" style="color: var(--text-secondary); font-size: 0.8rem; margin: 0;">
              Define your custom instructions for rewriting requirements. This block is injected into the LLM system prompt for the Quality Corrector.
            </p>

            <!-- 1. Header (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Corrector Persona (Read-only Header)</label>
              <div style="background-color: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 0.7rem; color: #666; max-height: 60px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; line-height: 1.25;">{{ fixedPromptHeaderCorrection }}</div>
            </div>

            <!-- 2. Custom Criteria (Editable) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.8rem; color: var(--color-primary);">Custom Correction Rules (Editable Context)</label>
              <textarea [(ngModel)]="customContextCorrectionText" rows="3" placeholder="Write your custom rewriting/correction guidelines here..." style="width: 100%; border: 1px solid var(--color-primary); border-radius: 6px; padding: 8px; font-size: 0.8rem; font-family: inherit; resize: vertical; outline: none;"></textarea>
            </div>

            <!-- 3. Footer (Read-only) -->
            <div class="form-group" style="margin-top: 4px;">
              <label class="form-label" style="font-weight: 600; font-size: 0.75rem;">Output Format Constraint (Read-only Footer)</label>
              <div style="background-color: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 0.7rem; color: #666; max-height: 60px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; line-height: 1.25;">{{ fixedPromptFooterCorrection }}</div>
            </div>
          </ng-container>

          <div style="display: flex; gap: 12px; margin-top: 8px; flex-shrink: 0;">
            <button type="button" class="btn btn-primary" (click)="saveCustomContext()" style="flex: 1;">Save Configurations</button>
            <button type="button" class="btn btn-secondary" (click)="closeCustomContextModal()">Cancel</button>
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

  rulesMode: 'strict' | 'rag' | 'custom' = 'strict';
  guidelines: any[] = [];
  selectedGuidelineIds: string[] = [];
  showDropdown = false;
  
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
    link.setAttribute("download", `AIRAM_Run_${this.activeRunId.substring(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  hasCorrections(): boolean {
    if (!this.results || this.results.length === 0) return false;
    return this.results.some(row => row.corrected_req && row.corrected_req !== '-' && row.corrected_req.trim() !== '');
  }

  // Pagination & Reset Methods
  getTotalPages(): number {
    return Math.ceil(this.results.length / this.pageSize) || 1;
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
