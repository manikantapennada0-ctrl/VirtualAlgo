import { DetectionMode } from '../types';
import { Icons } from '../utils/icons';

export class FloatingInputBar {
  private container: HTMLElement;
  private currentMode: DetectionMode = 'all';
  private isListening: boolean = false;
  private speechRecognizer: any = null;

  public onUploadClick?: () => void;
  public onCameraClick?: () => void;
  public onModeChange?: (mode: DetectionMode) => void;
  public onSubmit?: (text: string, mode: DetectionMode) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initSpeechRecognition();
  }

  public setMode(mode: DetectionMode) {
    this.currentMode = mode;
    this.render();
  }

  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.speechRecognizer = new SpeechRecognition();
        this.speechRecognizer.continuous = false;
        this.speechRecognizer.interimResults = false;
        this.speechRecognizer.lang = 'en-US';

        this.speechRecognizer.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          const input = document.getElementById('floating-query-input') as HTMLInputElement;
          if (input) {
            input.value = transcript;
            input.focus();
          }
          this.stopListening();
        };

        this.speechRecognizer.onerror = () => {
          this.stopListening();
        };

        this.speechRecognizer.onend = () => {
          this.stopListening();
        };
      } catch (err) {
        console.warn('Speech recognition not available', err);
      }
    }
  }

  private toggleListening() {
    if (!this.speechRecognizer) {
      alert('Speech recognition is not supported in this browser environment.');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  private startListening() {
    try {
      this.speechRecognizer.start();
      this.isListening = true;
      const micBtn = document.getElementById('mic-toggle-btn');
      micBtn?.classList.add('bg-red-500/20', 'text-red-400', 'border-red-500', 'animate-pulse');
      const input = document.getElementById('floating-query-input') as HTMLInputElement;
      if (input) input.placeholder = 'Listening for speech input...';
    } catch {
      this.stopListening();
    }
  }

  private stopListening() {
    this.isListening = false;
    try {
      this.speechRecognizer.stop();
    } catch {}
    const micBtn = document.getElementById('mic-toggle-btn');
    micBtn?.classList.remove('bg-red-500/20', 'text-red-400', 'border-red-500', 'animate-pulse');
    const input = document.getElementById('floating-query-input') as HTMLInputElement;
    if (input) input.placeholder = 'Detect objects, inspect coordinates, or ask question...';
  }

  public render() {
    const modeLabels: Record<DetectionMode, string> = {
      all: 'All Objects',
      people: 'People Analysis',
      vehicles: 'Vehicle Detection',
      traffic: 'Traffic Analysis',
      scene: 'Scene Overview',
      custom: 'Custom Query',
    };

    this.container.innerHTML = `
      <div class="w-full max-w-4xl mx-auto px-4">
        <div class="glass-panel rounded-2xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xl border border-cyan-500/30 glow-border">
          <!-- Add Image Action -->
          <button id="floating-upload-btn" class="p-2 sm:px-3 sm:py-2 rounded-xl bg-cyber-950/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 transition flex items-center gap-1.5 text-xs font-mono font-semibold" title="Upload Image (JPG, PNG, WEBP)">
            ${Icons.upload}
            <span class="hidden sm:inline">Upload</span>
          </button>

          <!-- Camera Action -->
          <button id="floating-camera-btn" class="p-2 sm:px-3 sm:py-2 rounded-xl bg-cyber-950/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 transition flex items-center gap-1.5 text-xs font-mono font-semibold" title="Capture from Device Camera">
            ${Icons.camera}
            <span class="hidden sm:inline">Camera</span>
          </button>

          <!-- Mode Selector Dropdown -->
          <div class="relative">
            <button id="mode-dropdown-btn" class="px-2.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1 transition">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span id="current-mode-label">${modeLabels[this.currentMode]}</span>
              <span class="text-[9px] text-cyan-400">▼</span>
            </button>

            <!-- Mode Menu -->
            <div id="mode-menu" class="hidden absolute bottom-full mb-2 left-0 w-48 rounded-xl glass-panel border border-cyan-500/30 p-1.5 shadow-2xl z-50 text-xs font-mono">
              <button class="mode-item w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition flex items-center justify-between ${this.currentMode === 'all' ? 'text-cyan-400 font-bold bg-cyan-950/50' : ''}" data-mode="all">
                <span>All Objects</span>
                ${this.currentMode === 'all' ? '✓' : ''}
              </button>
              <button class="mode-item w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition flex items-center justify-between ${this.currentMode === 'people' ? 'text-cyan-400 font-bold bg-cyan-950/50' : ''}" data-mode="people">
                <span>People Analysis</span>
                ${this.currentMode === 'people' ? '✓' : ''}
              </button>
              <button class="mode-item w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition flex items-center justify-between ${this.currentMode === 'vehicles' ? 'text-cyan-400 font-bold bg-cyan-950/50' : ''}" data-mode="vehicles">
                <span>Vehicle Detection</span>
                ${this.currentMode === 'vehicles' ? '✓' : ''}
              </button>
              <button class="mode-item w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition flex items-center justify-between ${this.currentMode === 'traffic' ? 'text-cyan-400 font-bold bg-cyan-950/50' : ''}" data-mode="traffic">
                <span>Traffic Analysis</span>
                ${this.currentMode === 'traffic' ? '✓' : ''}
              </button>
              <button class="mode-item w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition flex items-center justify-between ${this.currentMode === 'scene' ? 'text-cyan-400 font-bold bg-cyan-950/50' : ''}" data-mode="scene">
                <span>Scene Overview</span>
                ${this.currentMode === 'scene' ? '✓' : ''}
              </button>
              <button class="mode-item w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition flex items-center justify-between ${this.currentMode === 'custom' ? 'text-cyan-400 font-bold bg-cyan-950/50' : ''}" data-mode="custom">
                <span>Custom Query</span>
                ${this.currentMode === 'custom' ? '✓' : ''}
              </button>
            </div>
          </div>

          <!-- Query / Question Text Input -->
          <div class="flex-1 relative">
            <input type="text" id="floating-query-input" placeholder="Detect objects, inspect coordinates, or ask question..." class="w-full px-3 py-2 rounded-xl bg-cyber-950/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono" autocomplete="off" />
          </div>

          <!-- Microphone Button -->
          <button id="mic-toggle-btn" class="p-2 rounded-xl bg-cyber-950/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 transition" title="Voice Input">
            ${Icons.mic}
          </button>

          <!-- Submit / Send Button -->
          <button id="floating-send-btn" class="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:opacity-90 transition glow-cyan">
            <span>Send</span>
            ${Icons.send}
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    document.getElementById('floating-upload-btn')?.addEventListener('click', () => {
      this.onUploadClick?.();
    });

    document.getElementById('floating-camera-btn')?.addEventListener('click', () => {
      this.onCameraClick?.();
    });

    // Dropdown toggle
    const dropdownBtn = document.getElementById('mode-dropdown-btn');
    const menu = document.getElementById('mode-menu');
    dropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu?.classList.toggle('hidden');
    });

    window.addEventListener('click', () => {
      menu?.classList.add('hidden');
    });

    // Mode item click
    this.container.querySelectorAll('.mode-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = item.getAttribute('data-mode') as DetectionMode;
        if (mode) {
          this.currentMode = mode;
          this.render();
          this.onModeChange?.(mode);
        }
      });
    });

    // Mic button
    document.getElementById('mic-toggle-btn')?.addEventListener('click', () => {
      this.toggleListening();
    });

    // Send click & Enter key
    const sendBtn = document.getElementById('floating-send-btn');
    const input = document.getElementById('floating-query-input') as HTMLInputElement;

    const handleSend = () => {
      const text = input?.value.trim() || '';
      input.value = '';
      this.onSubmit?.(text, this.currentMode);
    };

    sendBtn?.addEventListener('click', handleSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }
}
