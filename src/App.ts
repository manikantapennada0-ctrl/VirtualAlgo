import { Header } from './components/Header';
import { HeroLanding } from './components/HeroLanding';
import { DetectionWorkspace } from './components/DetectionWorkspace';
import { DetectionSidebar } from './components/DetectionSidebar';
import { ChatAssistant } from './components/ChatAssistant';
import { FloatingInputBar } from './components/FloatingInputBar';
import { CameraModal } from './components/CameraModal';
import { SamplesModal } from './components/SamplesModal';
import { OutputsModal } from './components/OutputsModal';
import { SettingsModal } from './components/SettingsModal';
import { ThreeSpatialViewer } from './components/ThreeSpatialViewer';
import { LiveVideoDashboard } from './components/LiveVideoDashboard';

import { ApiService } from './services/apiService';
import { getCategoryColor, QUICK_PRESETS, SAMPLE_IMAGES } from './constants';
import { DetectedObject, DetectionMode, DetectionSensitivity, DetectionSession, SampleImage } from './types';

export class App {
  private root: HTMLElement;

  // Components
  private header!: Header;
  private hero!: HeroLanding;
  private workspace!: DetectionWorkspace;
  private sidebar!: DetectionSidebar;
  private chat!: ChatAssistant;
  private floatingBar!: FloatingInputBar;
  private cameraModal!: CameraModal;
  private samplesModal!: SamplesModal;
  private outputsModal!: OutputsModal;
  private settingsModal!: SettingsModal;
  private spatialViewer!: ThreeSpatialViewer;
  private videoDashboard: LiveVideoDashboard | null = null;

  // App State
  private currentView: 'image' | 'video' = 'image';
  private currentImageBase64: string | null = null;
  private currentImageUrl: string | null = null;
  private currentImageName: string = '';
  private currentImageWidth: number = 0;
  private currentImageHeight: number = 0;

  private detections: DetectedObject[] = [];
  private sceneSummary: string = '';
  private processingTimeMs: number = 0;
  private isAnalyzing: boolean = false;

  private currentMode: DetectionMode = 'all';
  private sensitivity: DetectionSensitivity = 'balanced';
  private customPrompt: string = '';

  private activeTab: 'telemetry' | 'chat' = 'telemetry';
  private isSpatialModeActive: boolean = false;

  // Session storage
  private currentSession: DetectionSession | null = null;
  private sessionHistory: DetectionSession[] = [];

  // File input
  private fileInput!: HTMLInputElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.init();
  }

  private async init() {
    this.renderSkeleton();
    this.initComponents();
    this.setupGlobalEvents();

    // Verify backend health
    const health = await ApiService.checkHealth();
    if (health.model) {
      this.header.setModel(health.model);
    }
    if (!health.hasApiKey) {
      this.header.setStatus('KEY NOT CONFIGURED', false);
    } else {
      this.header.setStatus('SYSTEM READY', false);
    }

    // Auto-load first benchmark sample so the app is instantly rich and testable!
    const defaultSample = SAMPLE_IMAGES[0];
    this.loadSampleImage(defaultSample, true);
  }

  private renderSkeleton() {
    this.root.innerHTML = `
      <div class="min-h-screen flex flex-col bg-cyber-950 text-slate-100 relative selection:bg-cyan-500 selection:text-black">
        <!-- Header Mount -->
        <div id="header-mount"></div>

        <!-- Image Grounding View Container -->
        <div id="image-view-container" class="flex flex-col flex-1">
          <!-- Hero Mount -->
          <div id="hero-mount"></div>

          <!-- Main Workspace Area -->
          <main class="flex-1 max-w-[1720px] w-full mx-auto p-2 sm:p-4 pb-28 flex flex-col lg:flex-row gap-4">
            <!-- Left: Interactive Image Workspace -->
            <div class="flex-1 flex flex-col glass-panel rounded-2xl sm:rounded-3xl border border-cyan-500/20 overflow-hidden shadow-2xl min-h-[500px]">
              <div id="workspace-mount" class="flex-1 flex flex-col"></div>
            </div>

            <!-- Right: Sidebar & Chat Tabs -->
            <div class="w-full lg:w-96 xl:w-[440px] flex flex-col glass-panel rounded-2xl sm:rounded-3xl border border-cyan-500/20 overflow-hidden shadow-2xl h-[560px] lg:h-auto">
              <!-- Tab Switcher -->
              <div class="flex items-center border-b border-cyan-500/20 bg-cyber-950/80 p-1.5 gap-1.5">
                <button id="tab-telemetry-btn" class="flex-1 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition ${this.activeTab === 'telemetry' ? 'bg-cyan-500 text-black shadow-lg glow-cyan' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
                  Objects & Telemetry
                </button>
                <button id="tab-chat-btn" class="flex-1 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition ${this.activeTab === 'chat' ? 'bg-cyan-500 text-black shadow-lg glow-cyan' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
                  AI Assistant
                </button>
              </div>

              <!-- Tab Content Containers -->
              <div class="flex-1 relative overflow-hidden">
                <div id="sidebar-mount" class="absolute inset-0 ${this.activeTab === 'telemetry' ? '' : 'hidden'}"></div>
                <div id="chat-mount" class="absolute inset-0 ${this.activeTab === 'chat' ? '' : 'hidden'}"></div>
              </div>
            </div>
          </main>
        </div>

        <!-- Live Video Detection View Container -->
        <div id="video-view-container" class="hidden flex-1 flex flex-col"></div>

        <!-- Floating Bottom Dock Mount -->
        <div id="floating-bar-mount" class="fixed bottom-4 left-0 right-0 z-30 pointer-events-auto"></div>

        <!-- Modals Mounts -->
        <div id="camera-modal-mount" class="hidden"></div>
        <div id="samples-modal-mount" class="hidden"></div>
        <div id="outputs-modal-mount" class="hidden"></div>
        <div id="settings-modal-mount" class="hidden"></div>
        <div id="spatial-viewer-mount" class="hidden"></div>

        <!-- Hidden File Input -->
        <input type="file" id="hidden-file-input" accept="image/jpeg,image/png,image/webp" class="hidden" />

        <!-- Notification Toast -->
        <div id="toast-container" class="fixed top-20 right-6 z-50 flex flex-col gap-2 pointer-events-none"></div>
      </div>
    `;

    this.fileInput = document.getElementById('hidden-file-input') as HTMLInputElement;
  }

  private initComponents() {
    this.header = new Header(document.getElementById('header-mount')!);
    this.hero = new HeroLanding(document.getElementById('hero-mount')!);
    this.workspace = new DetectionWorkspace(document.getElementById('workspace-mount')!);
    this.sidebar = new DetectionSidebar(document.getElementById('sidebar-mount')!);
    this.chat = new ChatAssistant(document.getElementById('chat-mount')!);
    this.floatingBar = new FloatingInputBar(document.getElementById('floating-bar-mount')!);

    this.cameraModal = new CameraModal(document.getElementById('camera-modal-mount')!);
    this.samplesModal = new SamplesModal(document.getElementById('samples-modal-mount')!);
    this.outputsModal = new OutputsModal(document.getElementById('outputs-modal-mount')!);
    this.settingsModal = new SettingsModal(document.getElementById('settings-modal-mount')!);
    this.spatialViewer = new ThreeSpatialViewer(document.getElementById('spatial-viewer-mount')!);

    // Render initial states
    this.header.render();
    this.hero.render(false);
    this.workspace.render(null);
    this.sidebar.render();
    this.chat.render();
    this.floatingBar.render();

    // Hook Header events
    this.header.onViewChange = (view) => this.switchView(view);
    this.header.onSamplesClick = () => this.samplesModal.open();
    this.header.onOutputsClick = () => {
      this.outputsModal.setData(this.currentSession, this.sessionHistory);
      this.outputsModal.open();
    };
    this.header.onSettingsClick = () => {
      this.settingsModal.setSensitivity(this.sensitivity);
      this.settingsModal.open();
    };
    this.header.onToggleSpatialMode = () => this.toggleSpatial3D();

    // Hook Hero events
    this.hero.onPresetClick = (presetId) => this.handlePreset(presetId);

    // Hook Workspace events
    this.workspace.onSelectObject = (obj) => {
      this.sidebar.setSelectedObjectId(obj?.object_id || null);
    };
    this.workspace.onHoverObject = (obj) => {
      // Synchronized hover
    };

    // Hook Sidebar events
    this.sidebar.onSelectObject = (obj) => {
      this.workspace.setSelectedObjectId(obj?.object_id || null);
    };
    this.sidebar.onToggleVisibility = (objId) => {
      const d = this.detections.find(x => x.object_id === objId);
      if (d) {
        d.visible = !d.visible;
        this.workspace.setDetections(this.detections);
        this.sidebar.setData(this.detections, this.processingTimeMs, this.sceneSummary);
      }
    };
    this.sidebar.onAskAboutObject = (obj) => {
      this.switchTab('chat');
      this.chat.askQuestion(`Tell me about object [${obj.object_id}] (${obj.label}). Describe its visual features, location, and role in this scene.`);
    };
    this.sidebar.onCategoryChange = (cat) => {
      this.workspace.setActiveCategory(cat);
    };

    // Hook Floating Bar events
    this.floatingBar.onUploadClick = () => this.fileInput.click();
    this.floatingBar.onCameraClick = () => this.cameraModal.open();
    this.floatingBar.onModeChange = (mode) => {
      this.currentMode = mode;
      this.showToast(`Detection Mode set to: ${mode.toUpperCase()}`, 'info');
      if (this.currentImageBase64) {
        this.runDetection();
      }
    };
    this.floatingBar.onSubmit = (text, mode) => {
      this.currentMode = mode;
      if (!text) {
        if (this.currentImageBase64) {
          this.runDetection();
        } else {
          this.fileInput.click();
        }
        return;
      }

      if (mode === 'custom') {
        this.customPrompt = text;
        this.runDetection();
      } else {
        // Direct question to AI assistant
        this.switchTab('chat');
        this.chat.askQuestion(text);
      }
    };

    // Hook Modals events
    this.cameraModal.onCapture = (base64) => {
      this.loadBase64Image(base64, `Camera_Capture_${new Date().toISOString().slice(11, 19)}.jpg`);
    };

    this.samplesModal.onSelectSample = (sample) => {
      this.loadSampleImage(sample, true);
    };

    this.outputsModal.onDownloadAnnotatedPng = () => {
      const canvas = this.workspace.exportAnnotatedCanvas();
      if (!canvas) {
        this.showToast('No active image to export.', 'error');
        return;
      }
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `visual_algo_annotated_${Date.now()}.png`;
      a.click();
      this.showToast('Annotated image downloaded with full-res telemetry bounding boxes!', 'success');
    };

    this.outputsModal.onReopenSession = (session) => {
      this.restoreSession(session);
    };

    this.outputsModal.onResetAnalysis = () => {
      this.resetAnalysis();
    };

    this.settingsModal.onSensitivityChange = (sens) => {
      this.sensitivity = sens;
      this.showToast(`Detection sensitivity tuned to: ${sens.toUpperCase()}`, 'info');
      if (this.currentImageBase64) {
        this.runDetection();
      }
    };

    this.settingsModal.onApiKeyChange = (hasKey) => {
      this.header.setStatus(hasKey ? 'CUSTOM KEY ACTIVE' : 'SYSTEM READY', false);
      this.showToast(hasKey ? 'Custom Gemini API Key active!' : 'Custom API Key removed.', 'info');
      if (this.currentImageBase64) {
        this.runDetection();
      }
    };

    this.spatialViewer.onClose = () => {
      this.isSpatialModeActive = false;
      this.header.setSpatialMode(false);
    };

    // Tab buttons
    document.getElementById('tab-telemetry-btn')?.addEventListener('click', () => this.switchTab('telemetry'));
    document.getElementById('tab-chat-btn')?.addEventListener('click', () => this.switchTab('chat'));

    // File input change
    this.fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.handleFile(file);
    });
  }

  private switchTab(tab: 'telemetry' | 'chat') {
    this.activeTab = tab;
    const telemetryBtn = document.getElementById('tab-telemetry-btn');
    const chatBtn = document.getElementById('tab-chat-btn');
    const sidebarMount = document.getElementById('sidebar-mount');
    const chatMount = document.getElementById('chat-mount');

    if (tab === 'telemetry') {
      telemetryBtn?.classList.add('bg-cyan-500', 'text-black', 'shadow-lg', 'glow-cyan');
      telemetryBtn?.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
      chatBtn?.classList.remove('bg-cyan-500', 'text-black', 'shadow-lg', 'glow-cyan');
      chatBtn?.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');

      sidebarMount?.classList.remove('hidden');
      chatMount?.classList.add('hidden');
    } else {
      chatBtn?.classList.add('bg-cyan-500', 'text-black', 'shadow-lg', 'glow-cyan');
      chatBtn?.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
      telemetryBtn?.classList.remove('bg-cyan-500', 'text-black', 'shadow-lg', 'glow-cyan');
      telemetryBtn?.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');

      chatMount?.classList.remove('hidden');
      sidebarMount?.classList.add('hidden');
    }
  }

  private setupGlobalEvents() {
    // Drag & Drop anywhere on screen
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.handleFile(file);
      }
    });

    // Delegate workspace internal button clicks
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#workspace-upload-btn')) {
        this.fileInput.click();
      } else if (target.closest('#workspace-camera-btn')) {
        this.cameraModal.open();
      }
    });
  }

  private handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.showToast('Please upload a valid JPG, PNG, or WEBP image.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.showToast('Image size exceeds 20MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      this.loadBase64Image(base64, file.name);
    };
    reader.readAsDataURL(file);
  }

  private async loadSampleImage(sample: SampleImage, triggerDetect: boolean = true) {
    try {
      this.showToast(`Ingesting benchmark scene: ${sample.title}...`, 'info');
      // Fetch and convert image to base64 so Gemini receives full bytes
      const response = await fetch(sample.url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        this.loadBase64Image(base64, `${sample.title}.jpg`, triggerDetect);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      this.showToast(`Failed to load sample: ${err.message}`, 'error');
    }
  }

  private loadBase64Image(base64: string, name: string, triggerDetect: boolean = true) {
    this.currentImageName = name;

    const img = new Image();
    img.onload = () => {
      this.currentImageWidth = img.naturalWidth;
      this.currentImageHeight = img.naturalHeight;

      // Optimize image resolution for network transfer if necessary (Vercel 4.5MB limit)
      let optimizedBase64 = base64;
      const MAX_DIM = 1800;
      if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM || base64.length > 2.5 * 1024 * 1024) {
        try {
          const canvas = document.createElement('canvas');
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > h && w > MAX_DIM) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else if (h > MAX_DIM) {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            optimizedBase64 = canvas.toDataURL('image/jpeg', 0.88);
          }
        } catch (e) {
          console.warn('Canvas optimization skipped:', e);
        }
      }

      this.currentImageBase64 = optimizedBase64;
      this.currentImageUrl = base64; // preserve original for workspace display

      this.hero.render(true);
      this.workspace.render(base64);

      if (triggerDetect) {
        this.runDetection();
      } else {
        this.detections = [];
        this.sidebar.setData([], 0, '');
        this.chat.setContext(optimizedBase64, [], '');
      }
    };
    img.src = base64;
  }

  private async runDetection() {
    if (!this.currentImageBase64 || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.header.setStatus('ANALYZING VISUAL SCENE...', true);
    this.workspace.render(this.currentImageUrl, true);
    this.showToast(`Running ${this.currentMode.toUpperCase()} object grounding...`, 'info');

    try {
      const result = await ApiService.detectObjects(
        this.currentImageBase64,
        this.currentMode,
        this.sensitivity,
        this.customPrompt
      );

      if (result.model_used) {
        this.header.setModel(result.model_used);
      }

      // Color code and enrich detections
      const enrichedDetections: DetectedObject[] = result.detections.map((d, index) => ({
        ...d,
        color: getCategoryColor(d.category),
        visible: true,
      }));

      this.detections = enrichedDetections;
      this.sceneSummary = result.scene_summary;
      this.processingTimeMs = result.processing_time_ms;

      // Update workspace & sidebar
      this.workspace.setDetections(this.detections);
      this.workspace.render(this.currentImageUrl, false);
      this.sidebar.setData(this.detections, this.processingTimeMs, this.sceneSummary);

      // Update AI chat context
      this.chat.setContext(this.currentImageBase64, this.detections, this.sceneSummary);

      // Save Session
      this.saveSession();

      if (result.isQuotaFallback) {
        this.header.setStatus(`GROUNDED: ${this.detections.length} OBJECTS (ADAPTIVE)`, false);
        this.showToast(
          `Localized ${this.detections.length} objects. (Adaptive offline grounding mode).`,
          'info'
        );
      } else {
        this.header.setStatus(`GROUNDED: ${this.detections.length} OBJECTS`, false);
        this.showToast(`Identified and localized ${this.detections.length} objects in ${this.processingTimeMs}ms`, 'success');
      }
    } catch (error: any) {
      console.error('Detection failure:', error);
      this.header.setStatus('DETECTION FAILED', false);
      this.workspace.render(this.currentImageUrl, false);
      this.showToast(`${error.message}`, 'error');
    } finally {
      this.isAnalyzing = false;
    }
  }

  private handlePreset(presetId: string) {
    const preset = QUICK_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    this.currentMode = preset.mode;
    this.floatingBar.setMode(preset.mode);

    if (this.currentImageBase64) {
      this.showToast(`Executing preset: "${preset.title}"...`, 'info');
      this.runDetection();
    } else {
      // Pick suitable sample
      const sample = preset.mode === 'vehicles' ? SAMPLE_IMAGES[0] : SAMPLE_IMAGES[4];
      this.loadSampleImage(sample, true);
    }
  }

  private saveSession() {
    if (!this.currentImageUrl) return;

    const session: DetectionSession = {
      id: `session_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      imageName: this.currentImageName,
      imageUrl: this.currentImageUrl,
      imageWidth: this.currentImageWidth,
      imageHeight: this.currentImageHeight,
      sceneSummary: this.sceneSummary,
      totalObjects: this.detections.length,
      processingTimeMs: this.processingTimeMs,
      mode: this.currentMode,
      sensitivity: this.sensitivity,
      detections: [...this.detections],
      chatHistory: [...this.chat.getMessages()],
    };

    this.currentSession = session;
    this.sessionHistory.unshift(session);
    if (this.sessionHistory.length > 10) this.sessionHistory.pop();
  }

  private restoreSession(session: DetectionSession) {
    this.currentSession = session;
    this.currentImageUrl = session.imageUrl;
    this.currentImageBase64 = session.imageUrl;
    this.currentImageName = session.imageName;
    this.currentImageWidth = session.imageWidth;
    this.currentImageHeight = session.imageHeight;
    this.detections = [...session.detections];
    this.sceneSummary = session.sceneSummary;
    this.processingTimeMs = session.processingTimeMs;
    this.currentMode = session.mode;
    this.sensitivity = session.sensitivity;

    this.hero.render(true);
    this.workspace.render(this.currentImageUrl, false);
    this.workspace.setDetections(this.detections);
    this.sidebar.setData(this.detections, this.processingTimeMs, this.sceneSummary);
    this.chat.setContext(this.currentImageBase64, this.detections, this.sceneSummary);
    this.floatingBar.setMode(this.currentMode);

    this.header.setStatus(`RESTORED: ${this.detections.length} OBJECTS`, false);
    this.showToast(`Session "${session.imageName}" restored.`, 'info');
  }

  private resetAnalysis() {
    this.currentImageBase64 = null;
    this.currentImageUrl = null;
    this.currentImageName = '';
    this.detections = [];
    this.sceneSummary = '';
    this.processingTimeMs = 0;
    this.currentSession = null;

    this.hero.render(false);
    this.workspace.render(null);
    this.sidebar.setData([], 0, '');
    this.chat.clearChat();
    this.header.setStatus('SYSTEM READY', false);
    this.showToast('Workspace reset.', 'info');
  }

  public switchView(view: 'image' | 'video') {
    this.currentView = view;
    this.header.setView(view);

    const imageViewContainer = document.getElementById('image-view-container');
    const videoViewContainer = document.getElementById('video-view-container');
    const floatingBar = document.getElementById('floating-bar-mount');

    if (view === 'video') {
      imageViewContainer?.classList.add('hidden');
      floatingBar?.classList.add('hidden');
      videoViewContainer?.classList.remove('hidden');

      if (!this.videoDashboard) {
        this.videoDashboard = new LiveVideoDashboard(videoViewContainer!);
        this.videoDashboard.init();
      }

      this.header.setStatus('LIVE VIDEO DETECTION READY', false);
      this.showToast('Switched to Live Video Capture & Tracking Suite.', 'info');
    } else {
      videoViewContainer?.classList.add('hidden');
      imageViewContainer?.classList.remove('hidden');
      floatingBar?.classList.remove('hidden');

      this.header.setStatus(
        this.detections.length > 0 ? `DETECTED: ${this.detections.length} OBJECTS` : 'SYSTEM READY',
        false
      );
      this.showToast('Switched to Image Object Grounding.', 'info');
    }
  }

  private toggleSpatial3D() {
    if (!this.currentImageUrl) {
      this.showToast('Please upload or select an image to view in 3D.', 'error');
      return;
    }

    this.isSpatialModeActive = !this.isSpatialModeActive;
    this.header.setSpatialMode(this.isSpatialModeActive);

    const spatialMount = document.getElementById('spatial-viewer-mount');
    if (this.isSpatialModeActive) {
      spatialMount?.classList.remove('hidden');
      this.spatialViewer.render(this.currentImageUrl, this.detections);
      this.showToast('3D Spatial Telemetry active: orbit, tilt & inspect depth bounding boxes.', 'info');
    } else {
      this.spatialViewer.dispose();
      spatialMount?.classList.add('hidden');
    }
  }

  private showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colorClasses = {
      info: 'border-cyan-500/40 text-cyan-300 bg-cyber-950/95',
      success: 'border-emerald-500/40 text-emerald-300 bg-cyber-950/95',
      error: 'border-red-500/40 text-red-300 bg-cyber-950/95',
    }[type];

    toast.className = `p-3 px-4 rounded-xl border ${colorClasses} shadow-2xl backdrop-blur-md text-xs font-mono flex items-center gap-2 transform translate-x-full transition-all duration-300 pointer-events-auto`;
    toast.innerHTML = `
      <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : type === 'error' ? 'bg-red-400' : 'bg-cyan-400'} glow-cyan"></span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}
