import { Component, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
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
        
        <div class="header-left">
          <div class="app-logo">
          <svg class="logo-svg" width="64" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
              <path d="M10 22L16 10L22 22" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M11.5 18H20.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 7L23.5 8.5L25 9L23.5 9.5L23 11L22.5 9.5L21 9L22.5 8.5L23 7Z" fill="#FFFBEB" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#0d6efd"/>
                  <stop offset="100%" stop-color="#00c9ff"/>
                </linearGradient>
              </defs>
            </svg>
            <span class="logo-text-main"> AIRAM</span>
          </div>
          
          <nav class="top-nav-tabs">
            <button class="nav-tab" [class.active]="activeTab === 'dashboard'" (click)="setTab('dashboard')">
              Dashboard
            </button>
            <button class="nav-tab" [class.active]="activeTab === 'analysis'" (click)="setTab('analysis')">
              Requirement Analysis
            </button>
            <button class="nav-tab" [class.active]="activeTab === 'rag'" (click)="setTab('rag')">
              RAG Configuration
            </button>
          </nav>
        </div>
        
        <div class="header-right">
          <!-- Backend Connection Status Indicator -->
          <div class="backend-status-badge" 
               [class.connected]="backendStatus === 'connected'" 
               [class.disconnected]="backendStatus === 'disconnected'" 
               [class.connecting]="backendStatus === 'connecting'"
               title="Backend: {{ backendUrl }}">
            <span class="status-indicator-dot"></span>
            <span class="status-text">{{ backendStatus | uppercase }}</span>
          </div>

          <div class="header-icons">
            <button class="icon-btn" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="container">
      <app-dashboard 
        [hidden]="activeTab !== 'dashboard'"
        [active]="activeTab === 'dashboard'"
        (viewRun)="onViewHistoryRun($event)"
        (newExecution)="setTab('analysis')">
      </app-dashboard>
      
      <app-requirements 
        #requirementsComp
        [hidden]="activeTab !== 'analysis'">
      </app-requirements>
      
      <app-rag-config 
        [hidden]="activeTab !== 'rag'">
      </app-rag-config>
    </main>
  `,
  styles: [`
    .app-header {
      background-color: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      height: 64px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 32px;
      height: 100%;
    }
    .app-logo {
      display: flex;
      align-items: center;
    }
    .logo-text-main {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--color-primary);
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .top-nav-tabs {
      display: flex;
      gap: 24px;
      height: 100%;
      align-items: center;
    }
    .nav-tab {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0 4px;
      height: 100%;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      position: relative;
    }
    .nav-tab:hover {
      color: var(--text-primary);
    }
    .nav-tab.active {
      color: var(--color-primary);
      font-weight: 600;
    }
    .nav-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background-color: var(--color-primary);
      border-top-left-radius: 3px;
      border-top-right-radius: 3px;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .header-icons {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .icon-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
      padding: 4px;
      border-radius: 50%;
    }
    .icon-btn:hover {
      color: var(--text-primary);
      background-color: #f1f5f9;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid var(--border-color);
    }
    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .backend-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.7rem;
      font-weight: 700;
      border: 1px solid transparent;
      background-color: #f8fafc;
      color: var(--text-secondary);
      user-select: none;
      pointer-events: auto;
    }
    .backend-status-badge.connected {
      background-color: #f1f5f9;
      color: #334155;
    }
    .backend-status-badge.disconnected {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .backend-status-badge.connecting {
      background-color: #dbeafe;
      color: #1e40af;
    }
    .status-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #64748b;
    }
    .connected .status-indicator-dot {
      background-color: var(--color-success);
    }
    .disconnected .status-indicator-dot {
      background-color: var(--color-danger);
    }
    .connecting .status-indicator-dot {
      background-color: var(--color-primary);
      animation: status-pulse 1.5s infinite;
    }
    @keyframes status-pulse {
      0% { opacity: 0.4; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
      100% { opacity: 0.4; transform: scale(0.8); }
    }
  `]
})
export class App implements OnInit {
  activeTab = 'dashboard';
  
  backendStatus: 'connected' | 'connecting' | 'disconnected' = 'connecting';
  backendUrl = '';



  @ViewChild('requirementsComp') requirementsComp?: RequirementsComponent;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  private ws: WebSocket | null = null;

  ngOnInit(): void {
    this.backendUrl = this.apiService.getBaseUrl();
    this.connectWebSocket();
  }

  connectWebSocket() {
    this.backendStatus = 'connecting';
    const wsUrl = this.backendUrl.replace(/^http/, 'ws') + '/api/ws/status';
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.backendStatus = 'connected';
        this.cdr.detectChanges();
      };

      this.ws.onclose = () => {
        this.backendStatus = 'disconnected';
        this.cdr.detectChanges();
        setTimeout(() => {
          if (this.backendStatus === 'disconnected') {
            this.connectWebSocket();
          }
        }, 3000);
      };

      this.ws.onerror = () => {
        this.backendStatus = 'disconnected';
        this.cdr.detectChanges();
      };
    } catch (e) {
      this.backendStatus = 'disconnected';
    }
  }

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
}
