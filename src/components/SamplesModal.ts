import { SAMPLE_IMAGES } from '../constants';
import { SampleImage } from '../types';
import { Icons } from '../utils/icons';

export class SamplesModal {
  private container: HTMLElement;
  public onSelectSample?: (sample: SampleImage) => void;

  constructor(container: HTMLElement) {
    this.container = container;
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
        <div class="relative w-full max-w-4xl glass-panel rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-cyber-950/80">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 glow-cyan"></span>
              <h3 class="text-sm font-mono font-bold uppercase tracking-wider text-white">CURATED BENCHMARK DATASETS</h3>
            </div>
            <button id="close-samples-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              ${Icons.close}
            </button>
          </div>

          <!-- Body Grid -->
          <div class="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${SAMPLE_IMAGES.map(sample => `
              <div class="sample-card group glass-panel-subtle rounded-2xl border border-slate-800 hover:border-cyan-400/60 overflow-hidden cursor-pointer transition duration-200 flex flex-col" data-id="${sample.id}">
                <div class="relative aspect-video w-full overflow-hidden bg-black/50">
                  <img src="${sample.url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${sample.title}" />
                  <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-cyan-400 border border-cyan-500/30">
                    ${sample.category}
                  </span>
                </div>
                <div class="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 class="text-sm font-bold text-white mb-1 group-hover:text-cyan-300 transition">${sample.title}</h4>
                    <p class="text-xs text-slate-400 leading-relaxed line-clamp-2">${sample.description}</p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span class="text-[10px] font-mono text-slate-500 uppercase">HIGH DENSITY SCAN</span>
                    <span class="text-xs font-mono font-bold text-cyan-400 group-hover:translate-x-1 transition flex items-center gap-1">
                      Load & Ground →
                    </span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-samples-modal')?.addEventListener('click', () => this.close());

    this.container.querySelectorAll('.sample-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const sample = SAMPLE_IMAGES.find(s => s.id === id);
        if (sample) {
          this.close();
          this.onSelectSample?.(sample);
        }
      });
    });
  }
}
