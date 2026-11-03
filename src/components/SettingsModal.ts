import { DetectionSensitivity } from '../types';
import { Icons } from '../utils/icons';

export class SettingsModal {
  private container: HTMLElement;
  private sensitivity: DetectionSensitivity = 'balanced';
  public onSensitivityChange?: (s: DetectionSensitivity) => void;

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
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <div class="relative w-full max-w-xl glass-panel rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col">
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
          <div class="p-6 space-y-6">
            <!-- Active AI Model Info -->
            <div class="p-4 rounded-2xl bg-cyber-950 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono font-bold text-slate-400 uppercase">ACTIVE VISION MODEL</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  ONLINE & SECURE
                </span>
              </div>
              <div class="text-base font-bold font-display text-white">gemini-3.1-flash-lite / gemini-3.8-flash</div>
              <p class="text-xs text-slate-400 leading-relaxed">
                Google AI Studio multimodal computer vision with instance-level 2D coordinate grounding ([ymin, xmin, ymax, xmax] 0..1000 normalized grid).
              </p>
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
                To unlock unlimited requests with high throughput, link a billing-enabled project key in AI Studio Secrets.
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
