import { Component, ViewChild, OnInit } from '@angular/core';
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
          <div class="logo-icon-container">
            <svg class="logo-svg" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          </div>
          <div class="logo-text-container">
            <span class="logo-text-main">AARAM</span>
            <span class="logo-text-sub">AI-Assisted Requirement Analysis & Management</span>
          </div>
        </div>
        
        <div class="header-right">
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
          </nav>

          <!-- Backend Connection Status Indicator -->
          <div class="backend-status-badge" 
               [class.connected]="backendStatus === 'connected'" 
               [class.disconnected]="backendStatus === 'disconnected'" 
               [class.connecting]="backendStatus === 'connecting'">
            <span class="status-indicator-dot"></span>
            <span class="status-text">Backend: {{ backendUrl }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="container">
      <app-dashboard 
        [hidden]="activeTab !== 'dashboard'"
        [active]="activeTab === 'dashboard'"
        (viewRun)="onViewHistoryRun($event)">
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
      gap: 12px;
    }
    .logo-icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-svg {
      display: block;
      filter: drop-shadow(0 2px 4px rgba(13, 110, 253, 0.25));
      transition: transform 0.3s ease;
    }
    .app-logo:hover .logo-svg {
      transform: scale(1.05) rotate(3deg);
    }
    .logo-text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .logo-text-main {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: 0.5px;
      line-height: 1.1;
    }
    .logo-text-sub {
      font-size: 0.62rem;
      font-weight: 500;
      color: var(--text-secondary);
      letter-spacing: 0.1px;
      line-height: 1.1;
      margin-top: 2px;
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
    .header-right {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .backend-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      background-color: #f8f9fa;
      color: var(--text-secondary);
      user-select: none;
      pointer-events: none;
    }
    .backend-status-badge.connected {
      background-color: #e6f4ea;
      color: var(--color-success);
      border-color: #c4ebd0;
    }
    .backend-status-badge.disconnected {
      background-color: #fce8e6;
      color: var(--color-danger);
      border-color: #f9d3cf;
    }
    .backend-status-badge.connecting {
      background-color: #e8f0fe;
      color: var(--color-primary);
      border-color: #d2e3fc;
    }
    .status-indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #6c757d;
      transition: background-color 0.3s ease, box-shadow 0.3s ease;
    }
    .connected .status-indicator-dot {
      background-color: var(--color-success);
      box-shadow: 0 0 6px var(--color-success);
      animation: status-pulse 2s infinite;
    }
    .disconnected .status-indicator-dot {
      background-color: var(--color-danger);
      box-shadow: 0 0 6px var(--color-danger);
    }
    .connecting .status-indicator-dot {
      background-color: var(--color-primary);
      animation: status-pulse 1.5s infinite;
    }
    @keyframes status-pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
  `]
})
export class App implements OnInit {
  activeTab = 'dashboard';
  
  backendStatus: 'connected' | 'connecting' | 'disconnected' = 'connecting';
  backendUrl = '';



  @ViewChild('requirementsComp') requirementsComp?: RequirementsComponent;

  constructor(private apiService: ApiService) {}

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
      };

      this.ws.onclose = () => {
        this.backendStatus = 'disconnected';
        setTimeout(() => {
          if (this.backendStatus === 'disconnected') {
            this.connectWebSocket();
          }
        }, 3000);
      };

      this.ws.onerror = () => {
        this.backendStatus = 'disconnected';
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
