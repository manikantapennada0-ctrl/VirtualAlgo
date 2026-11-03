import { DetectedObject } from '../types';
import { Icons } from '../utils/icons';

export class DetectionSidebar {
  private container: HTMLElement;
  private detections: DetectedObject[] = [];
  private selectedObjectId: string | null = null;
  private processingTimeMs: number = 0;
  private sceneSummary: string = '';

  // Filters
  private searchQuery: string = '';
  private selectedCategory: string = 'ALL';
  private minConfidence: number = 0.5;

  public onSelectObject?: (obj: DetectedObject | null) => void;
  public onToggleVisibility?: (objId: string) => void;
  public onToggleAllVisibility?: (show: boolean) => void;
  public onAskAboutObject?: (obj: DetectedObject) => void;
  public onCategoryChange?: (category: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setData(detections: DetectedObject[], processingTimeMs: number, sceneSummary: string) {
    this.detections = detections;
    this.processingTimeMs = processingTimeMs;
    this.sceneSummary = sceneSummary;
    this.render();
  }

  public setSelectedObjectId(id: string | null) {
    this.selectedObjectId = id;
    this.render();
    if (id) {
      const el = document.getElementById(`item-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  public render() {
    this.container.innerHTML = '';

    if (this.detections.length === 0) {
      this.container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
          <div class="w-12 h-12 rounded-xl border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
            ${Icons.target}
          </div>
          <p class="text-xs font-mono font-medium tracking-wider uppercase mb-1">Awaiting Object Grounding</p>
          <p class="text-[11px] text-slate-600 max-w-[200px]">Detection telemetry will populate here once an image is ingested.</p>
        </div>
      `;
      return;
    }

    // Stats calculations
    const total = this.detections.length;
    const categoriesMap: Record<string, number> = {};
    let totalConf = 0;

    this.detections.forEach(d => {
      categoriesMap[d.category] = (categoriesMap[d.category] || 0) + 1;
      totalConf += d.confidence;
    });

    const uniqueCategoriesCount = Object.keys(categoriesMap).length;
    const avgConf = total > 0 ? (totalConf / total * 100).toFixed(0) : '0';

    // Filter detections
    const filtered = this.detections.filter(d => {
      const matchesSearch = !this.searchQuery || 
        d.label.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        d.object_id.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        d.category.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesCat = this.selectedCategory === 'ALL' || d.category.toLowerCase() === this.selectedCategory.toLowerCase();
      const matchesConf = d.confidence >= this.minConfidence;
      return matchesSearch && matchesCat && matchesConf;
    });

    const selectedObj = this.detections.find(d => d.object_id === this.selectedObjectId);

    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-cyber-900/90 border-l border-cyan-500/20 backdrop-blur-md">
        <!-- Sidebar Header & Metrics -->
        <div class="p-3.5 border-b border-cyan-500/20 bg-cyber-950/60">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400 glow-cyan animate-pulse"></span>
              <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-white">DETECTION TELEMETRY</h4>
            </div>
            <span class="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              ${this.processingTimeMs > 0 ? `${this.processingTimeMs}ms` : 'REAL-TIME'}
            </span>
          </div>

          <!-- 4-Stat Grid -->
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div class="p-2 rounded-lg bg-cyber-850/80 border border-slate-800">
              <span class="text-[10px] font-mono text-slate-400 block uppercase">TOTAL OBJECTS</span>
              <span class="text-lg font-mono font-bold text-cyan-400">${total}</span>
            </div>
            <div class="p-2 rounded-lg bg-cyber-850/80 border border-slate-800">
              <span class="text-[10px] font-mono text-slate-400 block uppercase">CATEGORIES</span>
              <span class="text-lg font-mono font-bold text-orange-400">${uniqueCategoriesCount}</span>
            </div>
            <div class="p-2 rounded-lg bg-cyber-850/80 border border-slate-800">
              <span class="text-[10px] font-mono text-slate-400 block uppercase">AVG CONFIDENCE</span>
              <span class="text-lg font-mono font-bold text-emerald-400">${avgConf}%</span>
            </div>
            <div class="p-2 rounded-lg bg-cyber-850/80 border border-slate-800">
              <span class="text-[10px] font-mono text-slate-400 block uppercase">FILTERED MATCH</span>
              <span class="text-lg font-mono font-bold text-purple-400">${filtered.length}</span>
            </div>
          </div>

          <!-- Category Pills -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
            <button class="cat-pill px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition ${this.selectedCategory === 'ALL' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300 hover:text-white'}" data-cat="ALL">
              ALL (${total})
            </button>
            ${Object.entries(categoriesMap).map(([cat, count]) => `
              <button class="cat-pill px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition whitespace-nowrap ${this.selectedCategory === cat ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300 hover:text-white'}" data-cat="${cat}">
                ${cat} (${count})
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Search and Confidence Filter -->
        <div class="p-3 border-b border-slate-800 bg-cyber-950/40 space-y-2">
          <div class="relative">
            <input type="text" id="sidebar-search" value="${this.searchQuery}" placeholder="Filter by ID, label, category..." class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-cyber-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono" />
            <div class="absolute left-2.5 top-2 text-slate-500">
              ${Icons.search}
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>MIN CONFIDENCE:</span>
            <span class="text-cyan-400 font-bold">${Math.round(this.minConfidence * 100)}%</span>
          </div>
          <input type="range" id="sidebar-conf-slider" min="50" max="95" value="${Math.round(this.minConfidence * 100)}" class="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer" />
        </div>

        <!-- Selected Object Detail Card (If any) -->
        ${selectedObj ? `
          <div class="p-3 border-b border-cyan-500/30 bg-cyan-950/20">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                ${selectedObj.object_id}
              </span>
              <span class="text-[11px] font-mono text-slate-400">
                ${selectedObj.category}
              </span>
              <button id="close-detail-btn" class="text-slate-400 hover:text-white">
                ${Icons.close}
              </button>
            </div>
            <h5 class="text-sm font-bold text-white mb-1">${selectedObj.label}</h5>
            <p class="text-[11px] text-slate-300 mb-2 leading-relaxed">${selectedObj.description}</p>
            
            <div class="p-2 rounded bg-cyber-950/80 border border-slate-800/80 font-mono text-[10px] text-slate-400 space-y-1 mb-2">
              <div class="flex justify-between">
                <span>COORDINATES [Y0, X0, Y1, X1]:</span>
                <span class="text-cyan-400">[${selectedObj.box_2d.join(', ')}]</span>
              </div>
              <div class="flex justify-between">
                <span>BOUNDS SIZE:</span>
                <span class="text-slate-300">${((selectedObj.box_2d[3] - selectedObj.box_2d[1]) / 10).toFixed(1)}% × ${((selectedObj.box_2d[2] - selectedObj.box_2d[0]) / 10).toFixed(1)}%</span>
              </div>
            </div>

            <button id="ask-obj-btn" class="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-mono font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 hover:opacity-90 transition">
              ${Icons.chat} Inquire With AI
            </button>
          </div>
        ` : ''}

        <!-- Detection Items List -->
        <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
          ${filtered.length === 0 ? `
            <div class="p-4 text-center text-slate-500 text-xs font-mono">
              No objects matched current filter parameters.
            </div>
          ` : filtered.map(d => {
            const isSelected = d.object_id === this.selectedObjectId;
            return `
              <div id="item-${d.object_id}" class="object-item group p-2.5 rounded-xl border transition cursor-pointer select-none ${isSelected ? 'border-cyan-400 bg-cyan-950/30 glow-border' : 'border-slate-800/80 bg-cyber-950/40 hover:border-slate-700 hover:bg-slate-900/60'}" data-id="${d.object_id}">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${d.color};"></span>
                    <span class="text-[11px] font-mono font-bold text-slate-300 group-hover:text-cyan-300">${d.object_id}</span>
                    <span class="text-[10px] font-mono text-slate-500">${d.category}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-mono font-bold text-emerald-400">${(d.confidence * 100).toFixed(0)}%</span>
                    <button class="vis-btn p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition" data-id="${d.object_id}" title="Toggle Object Visibility">
                      ${d.visible ? Icons.eye : Icons.eyeOff}
                    </button>
                  </div>
                </div>
                <div class="text-xs font-semibold text-white tracking-wide truncate">${d.label}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    // Search input
    const searchInput = document.getElementById('sidebar-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.render();
      });
    }

    // Slider
    const confSlider = document.getElementById('sidebar-conf-slider') as HTMLInputElement;
    if (confSlider) {
      confSlider.addEventListener('input', (e) => {
        this.minConfidence = Number((e.target as HTMLInputElement).value) / 100;
        this.render();
      });
    }

    // Category pills
    this.container.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-cat') || 'ALL';
        this.render();
        this.onCategoryChange?.(this.selectedCategory);
      });
    });

    // Object item selection
    this.container.querySelectorAll('.object-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Prevent toggle button click from selecting
        if ((e.target as HTMLElement).closest('.vis-btn')) return;
        const id = item.getAttribute('data-id');
        const obj = this.detections.find(d => d.object_id === id) || null;
        this.selectedObjectId = obj?.object_id || null;
        this.render();
        if (this.onSelectObject) this.onSelectObject(obj);
      });
    });

    // Visibility toggles
    this.container.querySelectorAll('.vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id && this.onToggleVisibility) {
          this.onToggleVisibility(id);
        }
      });
    });

    // Close detail card
    document.getElementById('close-detail-btn')?.addEventListener('click', () => {
      this.selectedObjectId = null;
      this.render();
      if (this.onSelectObject) this.onSelectObject(null);
    });

    // Ask AI about object
    document.getElementById('ask-obj-btn')?.addEventListener('click', () => {
      const obj = this.detections.find(d => d.object_id === this.selectedObjectId);
      if (obj && this.onAskAboutObject) {
        this.onAskAboutObject(obj);
      }
    });
  }
}
