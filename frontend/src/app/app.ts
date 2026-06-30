import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardComponent } from './components/dashboard/dashboard';
import { RequirementsComponent } from './components/requirements/requirements';
import { RAGConfigComponent } from './components/rag-config/rag-config';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DashboardComponent,
    RequirementsComponent,
    RAGConfigComponent
  ],
  template: `
    <!-- Top Navigation Header (No Sidebar) -->
    <header class="app-header">
      <div class="header-container">
        <div class="app-logo">
          <span class="logo-icon">🚗</span>
          <span class="logo-text">ReQualiTrace <span class="logo-sub">Studio</span></span>
        </div>
        
        <nav class="top-nav-tabs">
          <button class="nav-tab" [class.active]="activeTab === 'dashboard'" (click)="setTab('dashboard')">
            📊 Dashboard
          </button>
          <button class="nav-tab" [class.active]="activeTab === 'analysis'" (click)="setTab('analysis')">
            🔍 Requirement Analysis
          </button>
          <button class="nav-tab" [class.active]="activeTab === 'rag'" (click)="setTab('rag')">
            ⚙️ RAG Configuration
          </button>
          <button class="nav-tab" [class.active]="activeTab === 'settings'" (click)="setTab('settings')">
            🔧 Standards Setup
          </button>
        </nav>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="container">
      <app-dashboard 
        *ngIf="activeTab === 'dashboard'"
        (viewRun)="onViewHistoryRun($event)">
      </app-dashboard>
      
      <app-requirements 
        #requirementsComp
        *ngIf="activeTab === 'analysis'">
      </app-requirements>
      
      <app-rag-config 
        *ngIf="activeTab === 'rag'">
      </app-rag-config>

      <!-- Guidelines Upload Standards Setup Tab -->
      <div *ngIf="activeTab === 'settings'" class="card" style="max-width: 600px; margin: 0 auto;">
        <div class="card-title">🔧 Upload Automotive Standards Guidelines</div>
        <p class="section-desc" style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
          Configure strict standard documents in JSON format (e.g. INCOSE rules list, ASPICE guidelines) to enable validation.
        </p>

        <div class="form-group">
          <label class="form-label">Standards Document Name (e.g. INCOSE Rules, ASPICE SWE.1)</label>
          <input type="text" [(ngModel)]="newStandardName" placeholder="Enter name...">
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
    </main>
  `,
  styles: [`
    .app-header {
      background-color: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      height: 70px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .app-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .logo-icon {
      font-size: 1.6rem;
    }
    .logo-sub {
      color: var(--color-primary);
      font-weight: 500;
    }
    .top-nav-tabs {
      display: flex;
      gap: 8px;
      height: 100%;
      align-items: center;
    }
    .nav-tab {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-tab:hover {
      background-color: #f1f3f5;
      color: var(--text-primary);
    }
    .nav-tab.active {
      background-color: #e8f0fe;
      color: var(--color-primary);
      font-weight: 600;
    }
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
  `]
})
export class App {
  activeTab = 'dashboard';
  
  // Standards upload bindings
  newStandardName = '';
  standardFile: File | null = null;
  isUploadingStandard = false;
  uploadedStatus = '';

  @ViewChild('requirementsComp') requirementsComp?: RequirementsComponent;

  constructor(private apiService: ApiService) {}

  setTab(tabName: string) {
    this.activeTab = tabName;
  }

  onViewHistoryRun(runId: string) {
    this.activeTab = 'analysis';
    // Let view render, then load results
    setTimeout(() => {
      if (this.requirementsComp) {
        this.requirementsComp.loadResults(runId);
      }
    }, 100);
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
      },
      error: (err) => {
        this.isUploadingStandard = false;
        alert('Failed to upload guidelines: ' + (err.error?.detail || err.message));
      }
    });
  }
}
