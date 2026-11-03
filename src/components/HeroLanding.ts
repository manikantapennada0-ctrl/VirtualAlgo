import { QUICK_PRESETS } from '../constants';
import { Icons } from '../utils/icons';

export class HeroLanding {
  private container: HTMLElement;
  public onPresetClick?: (presetId: string) => void;
  public onUploadClick?: () => void;
  public onSampleClick?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(hasActiveImage: boolean = false) {
    if (hasActiveImage) {
      // Minimized bar when image is active so user has maximum screen real estate for visualization
      this.container.innerHTML = `
        <div class="w-full bg-cyber-950/60 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs font-mono">
          <div class="flex items-center gap-2 text-slate-400">
            <span class="text-cyan-400 font-bold">INQUIRY PRESETS:</span>
            <span class="hidden md:inline text-slate-500">Select any preset below to target specific telemetry:</span>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto">
            ${QUICK_PRESETS.map(p => `
              <button class="preset-pill px-2.5 py-1 rounded-lg bg-cyber-900 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 text-slate-300 text-[11px] whitespace-nowrap transition" data-id="${p.id}">
                ${p.title}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      this.bindEvents();
      return;
    }

    this.container.innerHTML = `
      <section class="relative pt-12 pb-8 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <!-- Brand Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-[11px] font-mono text-cyan-400 mb-6 glow-cyan shadow-lg">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          OPEN-VOCABULARY MULTI-SCALE VISUAL PERCEPTION ENGINE
        </div>

        <!-- Main Heading with Neon Gradient Typography -->
        <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold font-display tracking-tight text-white mb-4">
          <span class="bg-gradient-to-r from-cyan-400 via-sky-200 to-orange-400 bg-clip-text text-transparent">
            VISUAL ALGO
          </span>
        </h1>

        <!-- Subtitle -->
        <p class="text-base sm:text-xl text-slate-300 font-light max-w-2xl mx-auto mb-8 leading-relaxed">
          Detect and localize every recognizable object with <span class="text-cyan-400 font-medium">precision coordinate telemetry</span> and conversational intelligence.
        </p>

        <!-- 4 Quick Inquiry Preset Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 max-w-4xl mx-auto text-left mb-6">
          ${QUICK_PRESETS.map(preset => `
            <button class="preset-card group p-4 rounded-2xl glass-panel-subtle border border-slate-800 hover:border-cyan-400/60 hover:bg-cyber-900/80 transition duration-200 flex flex-col justify-between" data-id="${preset.id}">
              <div>
                <div class="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  ${Icons.target}
                </div>
                <h4 class="text-xs font-bold font-mono text-white mb-1 group-hover:text-cyan-300 transition line-clamp-2">
                  ${preset.title}
                </h4>
                <p class="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  ${preset.subtitle}
                </p>
              </div>
              <div class="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500 group-hover:text-cyan-400">
                <span>EXECUTE PRESET</span>
                <span>→</span>
              </div>
            </button>
          `).join('')}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    this.container.querySelectorAll('.preset-card, .preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id && this.onPresetClick) {
          this.onPresetClick(id);
        }
      });
    });
  }
}
