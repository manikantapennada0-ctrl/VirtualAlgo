import { DetectionSensitivity } from '../types';
import { Icons } from '../utils/icons';
import { ApiService } from '../services/apiService';

export class SettingsModal {
  private container: HTMLElement;
  private sensitivity: DetectionSensitivity = 'balanced';
  public onSensitivityChange?: (s: DetectionSensitivity) => void;
  public onApiKeyChange?: (hasKey: boolean) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setSensitivity(s: DetectionSensitivity) {
    this.sensitivity = s;
  }

  public open() {
    this.container.classList.remove('hidden');
    this.render();
  }

  public close() {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }

  public render() {
    const currentKey = ApiService.getStoredApiKey();
    const maskedKey = currentKey
      ? `${currentKey.slice(0, 6)}...${currentKey.slice(-4)}`
      : '';

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <div class="relative w-full max-w-xl glass-panel rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-cyber-950/80">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 glow-cyan"></span>
              <h3 class="text-sm font-mono font-bold uppercase tracking-wider text-white">SYSTEM TELEMETRY & API CONFIGURATION</h3>
            </div>
            <button id="close-settings-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              ${Icons.close}
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <!-- Active AI Model Info -->
            <div class="p-4 rounded-2xl bg-cyber-950 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono font-bold text-slate-400 uppercase">ACTIVE VISION ENGINE</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  ONLINE & SECURE
                </span>
              </div>
              <div class="text-base font-bold font-display text-white">Gemini 2.5 Flash / 2.0 Flash / 3.x Flash</div>
              <p class="text-xs text-slate-400 leading-relaxed">
                Google AI Studio multimodal computer vision with instance-level 2D coordinate grounding ([ymin, xmin, ymax, xmax] 0..1000 normalized grid).
              </p>
            </div>

            <!-- API Key Configuration -->
            <div class="p-4 rounded-2xl bg-cyber-950 border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 block">
                  CUSTOM GEMINI API KEY (OPTIONAL)
                </label>
                <span id="key-status-badge" class="px-2 py-0.5 rounded text-[10px] font-mono ${
                  currentKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }">
                  ${currentKey ? 'CUSTOM KEY ACTIVE' : 'SERVER KEY DEFAULT'}
                </span>
              </div>
              <p class="text-xs text-slate-400 leading-relaxed">
                Connect your Google AI Studio API key directly. Keys are stored locally in your browser and sent securely via encrypted HTTPS headers.
              </p>
              <div class="flex items-center gap-2">
                <input
                  type="password"
                  id="custom-gemini-key-input"
                  placeholder="${currentKey ? maskedKey : 'Enter AIzaSy... API key'}"
                  class="flex-1 px-3 py-2 rounded-xl bg-cyber-900 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:border-cyan-400 focus:outline-none"
                  autocomplete="off"
                />
                <button
                  id="save-key-btn"
                  class="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs transition"
                >
                  SAVE
                </button>
                ${
                  currentKey
                    ? `<button id="clear-key-btn" class="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs font-mono transition" title="Remove custom key">✕</button>`
                    : ''
                }
              </div>
              <div id="key-feedback" class="text-[11px] font-mono text-slate-500">
                ${
                  currentKey
                    ? 'Using your custom API key for vision grounding.'
                    : 'No custom key set. Using environment GEMINI_API_KEY from server.'
                }
              </div>
            </div>

            <!-- Free Tier Quota & Unlimited Key Notice -->
            <div class="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-cyan-400 glow-cyan"></span>
                <span class="text-xs font-mono font-bold text-cyan-300 uppercase">QUOTA & ACCELERATION</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">
                Free Tier provides daily requests per project. If rate-limits are reached, VISUAL ALGO seamlessly switches to high-precision adaptive offline telemetry.
              </p>
              <div class="pt-1 text-[11px] font-mono text-cyan-400">
                To unlock unlimited requests with high throughput, link a billing-enabled project key above or in Vercel environment variables.
              </div>
            </div>

            <!-- Detection Sensitivity Tuning -->
            <div>
              <label class="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 block mb-2">
                DETECTION SENSITIVITY BIAS
              </label>
              <div class="grid grid-cols-3 gap-2.5">
                <button class="sens-btn p-3 rounded-xl border text-center transition ${this.sensitivity === 'balanced' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold' : 'border-slate-800 bg-cyber-950 text-slate-400 hover:text-white'}" data-sens="balanced">
                  <div class="text-xs font-mono mb-1">BALANCED</div>
                  <div class="text-[10px] text-slate-500 leading-tight">Optimal recall vs precision</div>
                </button>
                <button class="sens-btn p-3 rounded-xl border text-center transition ${this.sensitivity === 'recall' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold' : 'border-slate-800 bg-cyber-950 text-slate-400 hover:text-white'}" data-sens="recall">
                  <div class="text-xs font-mono mb-1">HIGH RECALL</div>
                  <div class="text-[10px] text-slate-500 leading-tight">Find small & subtle objects</div>
                </button>
                <button class="sens-btn p-3 rounded-xl border text-center transition ${this.sensitivity === 'precision' ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold' : 'border-slate-800 bg-cyber-950 text-slate-400 hover:text-white'}" data-sens="precision">
                  <div class="text-xs font-mono mb-1">PRECISION</div>
                  <div class="text-[10px] text-slate-500 leading-tight">High confidence only</div>
                </button>
              </div>
            </div>

            <!-- Coordinate Scale System -->
            <div class="p-4 rounded-2xl bg-cyber-950 border border-slate-800 space-y-1">
              <span class="text-xs font-mono font-bold text-slate-400 uppercase block mb-1">SPATIAL TELEMETRY RESOLUTION</span>
              <div class="text-xs font-mono text-cyan-300">Normalized Scale: [0, 0] top-left to [1000, 1000] bottom-right</div>
              <div class="text-[11px] text-slate-400">Maintains exact aspect-ratio invariant mapping across any monitor or viewport.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-settings-modal')?.addEventListener('click', () => this.close());

    // Save key listener
    document.getElementById('save-key-btn')?.addEventListener('click', () => {
      const input = document.getElementById('custom-gemini-key-input') as HTMLInputElement;
      const key = input ? input.value.trim() : '';
      if (key) {
        ApiService.setUserApiKey(key);
        this.onApiKeyChange?.(true);
        this.render();
      }
    });

    // Clear key listener
    document.getElementById('clear-key-btn')?.addEventListener('click', () => {
      ApiService.setUserApiKey('');
      this.onApiKeyChange?.(false);
      this.render();
    });

    this.container.querySelectorAll('.sens-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sens = btn.getAttribute('data-sens') as DetectionSensitivity;
        if (sens) {
          this.sensitivity = sens;
          this.onSensitivityChange?.(sens);
          this.render();
        }
      });
    });
  }
}
