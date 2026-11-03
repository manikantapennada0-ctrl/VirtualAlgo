import { DetectionSession } from '../types';
import { Icons } from '../utils/icons';

export class OutputsModal {
  private container: HTMLElement;
  private currentSession: DetectionSession | null = null;
  private sessionHistory: DetectionSession[] = [];

  public onDownloadAnnotatedPng?: () => void;
  public onReopenSession?: (session: DetectionSession) => void;
  public onResetAnalysis?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setData(current: DetectionSession | null, history: DetectionSession[]) {
    this.currentSession = current;
    this.sessionHistory = history;
  }

  public open() {
    this.container.classList.remove('hidden');
    this.render();
  }

  public close() {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }

  private downloadJson() {
    if (!this.currentSession) return;
    const exportData = {
      session_id: this.currentSession.id,
      timestamp: this.currentSession.timestamp,
      image_name: this.currentSession.imageName,
      dimensions: {
        width: this.currentSession.imageWidth,
        height: this.currentSession.imageHeight,
      },
      scene_summary: this.currentSession.sceneSummary,
      total_objects: this.currentSession.totalObjects,
      processing_time_ms: this.currentSession.processingTimeMs,
      mode: this.currentSession.mode,
      sensitivity: this.currentSession.sensitivity,
      detections: this.currentSession.detections.map(d => ({
        object_id: d.object_id,
        label: d.label,
        category: d.category,
        confidence: d.confidence,
        box_2d: d.box_2d,
        normalized_box: d.normalized_box,
        description: d.description,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visual_algo_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private downloadCsv() {
    if (!this.currentSession) return;
    const headers = ['object_id', 'label', 'category', 'confidence', 'ymin_norm', 'xmin_norm', 'ymax_norm', 'xmax_norm', 'description'];
    const rows = this.currentSession.detections.map(d => [
      d.object_id,
      `"${d.label.replace(/"/g, '""')}"`,
      `"${d.category.replace(/"/g, '""')}"`,
      d.confidence.toFixed(2),
      d.box_2d[0],
      d.box_2d[1],
      d.box_2d[2],
      d.box_2d[3],
      `"${d.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visual_algo_detections_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private copyCoordinates() {
    if (!this.currentSession) return;
    const coords = this.currentSession.detections.map(d => 
      `${d.object_id} (${d.label}): [ymin: ${d.box_2d[0]}, xmin: ${d.box_2d[1]}, ymax: ${d.box_2d[2]}, xmax: ${d.box_2d[3]}]`
    ).join('\n');

    navigator.clipboard.writeText(coords).then(() => {
      const btn = document.getElementById('copy-coords-btn');
      if (btn) {
        btn.innerHTML = `${Icons.check} Copied to Clipboard!`;
        btn.classList.add('text-cyan-400', 'border-cyan-400');
        setTimeout(() => {
          btn.innerHTML = `${Icons.copy} Copy All Coordinates`;
          btn.classList.remove('text-cyan-400', 'border-cyan-400');
        }, 2000);
      }
    });
  }

  public render() {
    const hasData = Boolean(this.currentSession && this.currentSession.detections.length > 0);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <div class="relative w-full max-w-3xl glass-panel rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-cyber-950/80">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 glow-cyan"></span>
              <h3 class="text-sm font-mono font-bold uppercase tracking-wider text-white">TELEMETRY EXPORT & SESSION ARCHIVE</h3>
            </div>
            <button id="close-outputs-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              ${Icons.close}
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Active Export Options -->
            <div>
              <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 mb-3">CURRENT DETECTION EXPORT</h4>
              ${hasData ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <!-- Annotated Image Download -->
                  <button id="export-annotated-btn" class="p-4 rounded-2xl glass-panel-subtle border border-cyan-500/30 hover:border-cyan-400 text-left transition group">
                    <div class="flex items-center justify-between mb-2">
                      <span class="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition">
                        ${Icons.download}
                      </span>
                      <span class="text-[10px] font-mono text-cyan-400">PNG IMAGE</span>
                    </div>
                    <div class="text-sm font-bold text-white mb-1">Annotated High-Res Image</div>
                    <p class="text-xs text-slate-400">Export image stamped with color-coded bounding boxes and labels.</p>
                  </button>

                  <!-- JSON Data Download -->
                  <button id="export-json-btn" class="p-4 rounded-2xl glass-panel-subtle border border-slate-800 hover:border-purple-400 text-left transition group">
                    <div class="flex items-center justify-between mb-2">
                      <span class="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition">
                        ${Icons.sparkles}
                      </span>
                      <span class="text-[10px] font-mono text-purple-400">JSON FORMAT</span>
                    </div>
                    <div class="text-sm font-bold text-white mb-1">Full Telemetry JSON</div>
                    <p class="text-xs text-slate-400">Complete normalized coordinates, taxonomy, and scene metadata.</p>
                  </button>

                  <!-- CSV Spreadsheet Download -->
                  <button id="export-csv-btn" class="p-4 rounded-2xl glass-panel-subtle border border-slate-800 hover:border-emerald-400 text-left transition group">
                    <div class="flex items-center justify-between mb-2">
                      <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition">
                        ${Icons.box}
                      </span>
                      <span class="text-[10px] font-mono text-emerald-400">CSV SPREADSHEET</span>
                    </div>
                    <div class="text-sm font-bold text-white mb-1">Object Matrix CSV</div>
                    <p class="text-xs text-slate-400">Spreadsheet table of labels, categories, scores, and bounding boxes.</p>
                  </button>

                  <!-- Copy Coordinates -->
                  <button id="copy-coords-btn" class="p-4 rounded-2xl glass-panel-subtle border border-slate-800 hover:border-orange-400 text-left transition group">
                    <div class="flex items-center justify-between mb-2">
                      <span class="p-2 rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition">
                        ${Icons.copy}
                      </span>
                      <span class="text-[10px] font-mono text-orange-400">CLIPBOARD</span>
                    </div>
                    <div class="text-sm font-bold text-white mb-1">Copy Coordinates</div>
                    <p class="text-xs text-slate-400">Copy formatted normalized coordinate telemetry list.</p>
                  </button>
                </div>
              ` : `
                <div class="p-6 rounded-2xl border border-slate-800 bg-cyber-950 text-center text-slate-500 text-xs font-mono">
                  No active telemetry data to export. Perform an object detection first.
                </div>
              `}
            </div>

            <!-- Session History Archive -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">SESSION ARCHIVE (${this.sessionHistory.length})</h4>
                ${hasData ? `
                  <button id="reset-session-btn" class="text-xs font-mono text-red-400 hover:text-red-300 transition flex items-center gap-1">
                    ${Icons.trash} Reset Active Session
                  </button>
                ` : ''}
              </div>

              <div class="space-y-2">
                ${this.sessionHistory.length === 0 ? `
                  <div class="p-4 rounded-xl border border-slate-800/80 bg-cyber-950/60 text-center text-slate-600 text-xs font-mono">
                    No previous sessions in memory.
                  </div>
                ` : this.sessionHistory.map(session => `
                  <div class="session-item p-3 rounded-xl border border-slate-800 bg-cyber-950 hover:border-cyan-500/40 transition flex items-center justify-between cursor-pointer" data-id="${session.id}">
                    <div class="flex items-center gap-3">
                      <img src="${session.imageUrl}" class="w-12 h-12 object-cover rounded-lg border border-slate-800" />
                      <div>
                        <div class="text-xs font-bold text-white mb-0.5">${session.imageName}</div>
                        <div class="text-[10px] font-mono text-slate-400">
                          ${session.totalObjects} objects • ${session.mode.toUpperCase()} • ${session.timestamp}
                        </div>
                      </div>
                    </div>
                    <button class="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono hover:bg-cyan-500/20 transition">
                      Reopen
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-outputs-modal')?.addEventListener('click', () => this.close());
    document.getElementById('export-annotated-btn')?.addEventListener('click', () => this.onDownloadAnnotatedPng?.());
    document.getElementById('export-json-btn')?.addEventListener('click', () => this.downloadJson());
    document.getElementById('export-csv-btn')?.addEventListener('click', () => this.downloadCsv());
    document.getElementById('copy-coords-btn')?.addEventListener('click', () => this.copyCoordinates());

    document.getElementById('reset-session-btn')?.addEventListener('click', () => {
      this.close();
      this.onResetAnalysis?.();
    });

    this.container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const session = this.sessionHistory.find(s => s.id === id);
        if (session) {
          this.close();
          this.onReopenSession?.(session);
        }
      });
    });
  }
}
