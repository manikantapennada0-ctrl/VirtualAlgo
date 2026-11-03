import { Icons } from '../utils/icons';

export class Header {
  private container: HTMLElement;
  private statusText: string = 'SYSTEM READY';
  private activeModel: string = 'gemini-2.5-flash';
  private isAnalyzing: boolean = false;
  private isSpatialMode: boolean = false;
  private currentView: 'image' | 'video' = 'image';

  public onSamplesClick?: () => void;
  public onOutputsClick?: () => void;
  public onSettingsClick?: () => void;
  public onToggleSpatialMode?: () => void;
  public onViewChange?: (view: 'image' | 'video') => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setStatus(text: string, isAnalyzing: boolean = false) {
    this.statusText = text;
    this.isAnalyzing = isAnalyzing;
    this.render();
  }

  public setModel(model: string) {
    if (model) {
      this.activeModel = model;
      this.render();
    }
  }

  public setSpatialMode(active: boolean) {
    this.isSpatialMode = active;
    this.render();
  }

  public setView(view: 'image' | 'video') {
    this.currentView = view;
    this.render();
  }

  public render() {
    this.container.innerHTML = `
      <header class="w-full border-b border-cyan-500/20 bg-cyber-950/85 backdrop-blur-xl sticky top-0 z-40">
        <div class="max-w-[1720px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <!-- Logo & Brand Identity -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl glass-panel flex items-center justify-center glow-cyan shadow-lg">
              ${Icons.logo}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-base sm:text-xl font-extrabold font-display tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-orange-400 bg-clip-text text-transparent">
                  VISUAL ALGO
                </span>
                <span class="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  v2.0
                </span>
              </div>
              <p class="hidden md:block text-[9px] font-mono text-slate-400 tracking-widest uppercase">
                AI COMPUTER VISION & REAL-TIME TRACKING SUITE
              </p>
            </div>
          </div>

          <!-- Central Mode Switcher: Image Grounding vs Live Video Detection -->
          <div class="flex items-center p-1 rounded-2xl bg-cyber-900/90 border border-cyan-500/30 shadow-inner">
            <button id="nav-mode-image" class="px-2.5 sm:px-4 py-1.5 rounded-xl font-mono text-xs font-bold uppercase flex items-center gap-1.5 transition ${
              this.currentView === 'image'
                ? 'bg-cyan-500 text-black shadow-lg glow-cyan'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }">
              ${Icons.camera}
              <span class="hidden sm:inline">Image Grounding</span>
              <span class="sm:hidden">Image</span>
            </button>
            <button id="nav-mode-video" class="px-2.5 sm:px-4 py-1.5 rounded-xl font-mono text-xs font-bold uppercase flex items-center gap-1.5 transition ${
              this.currentView === 'video'
                ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/40 glow-cyan'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }">
              ${Icons.video}
              <span class="hidden sm:inline">Live Video Detection</span>
              <span class="sm:hidden">Video</span>
              <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            </button>
          </div>

          <!-- Actions & Status Indicator -->
          <div class="flex items-center gap-1.5 sm:gap-2.5">
            <!-- System Status -->
            <div class="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyber-900 border border-slate-800 text-[11px] font-mono">
              <span class="w-2 h-2 rounded-full ${this.isAnalyzing ? 'bg-orange-400 animate-ping' : 'bg-emerald-400 glow-cyan'}"></span>
              <span class="text-slate-300">${this.statusText}</span>
              <span class="text-slate-600">|</span>
              <span class="text-cyan-400 font-bold">${this.activeModel}</span>
            </div>

            <!-- Spatial 3D / XR Mode Toggle -->
            <button id="header-spatial-btn" class="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 transition ${
              this.isSpatialMode
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black glow-cyan'
                : 'glass-panel text-slate-300 hover:text-cyan-300 hover:border-cyan-400'
            }" title="Toggle 3D Holographic / Spatial View">
              ${Icons.xr}
              <span class="hidden sm:inline">${this.isSpatialMode ? 'Exit 3D' : '3D Spatial'}</span>
            </button>

            <!-- Samples Button -->
            <button id="header-samples-btn" class="px-2 sm:px-3 py-1.5 rounded-xl glass-panel text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition flex items-center gap-1.5">
              ${Icons.box}
              <span class="hidden sm:inline">Samples</span>
            </button>

            <!-- Outputs Button -->
            <button id="header-outputs-btn" class="px-2 sm:px-3 py-1.5 rounded-xl glass-panel text-xs font-mono text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition flex items-center gap-1.5">
              ${Icons.download}
              <span class="hidden sm:inline">Outputs</span>
            </button>

            <!-- Settings Button -->
            <button id="header-settings-btn" class="p-2 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition" title="Connection Settings">
              ${Icons.settings}
            </button>
          </div>
        </div>
      </header>
    `;

    document.getElementById('nav-mode-image')?.addEventListener('click', () => {
      this.currentView = 'image';
      this.render();
      this.onViewChange?.('image');
    });

    document.getElementById('nav-mode-video')?.addEventListener('click', () => {
      this.currentView = 'video';
      this.render();
      this.onViewChange?.('video');
    });

    document.getElementById('header-samples-btn')?.addEventListener('click', () => this.onSamplesClick?.());
    document.getElementById('header-outputs-btn')?.addEventListener('click', () => this.onOutputsClick?.());
    document.getElementById('header-settings-btn')?.addEventListener('click', () => this.onSettingsClick?.());
    document.getElementById('header-spatial-btn')?.addEventListener('click', () => this.onToggleSpatialMode?.());
  }
}
