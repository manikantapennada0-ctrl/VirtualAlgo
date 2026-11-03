import { DetectedObject } from '../types';
import { Icons } from '../utils/icons';

export interface WorkspaceOptions {
  showBoxes: boolean;
  showLabels: boolean;
  showConfidence: boolean;
  sideBySide: boolean;
}

export class DetectionWorkspace {
  private container: HTMLElement;
  private imageElement: HTMLImageElement | null = null;
  private canvasOverlay: HTMLCanvasElement | null = null;
  private detections: DetectedObject[] = [];
  private selectedObjectId: string | null = null;
  private hoveredObjectId: string | null = null;
  private activeCategory: string = 'ALL';

  // Zoom & Pan State
  private zoomLevel: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private startPanX: number = 0;
  private startPanY: number = 0;

  // Display toggles
  public options: WorkspaceOptions = {
    showBoxes: true,
    showLabels: true,
    showConfidence: true,
    sideBySide: false,
  };

  // Event callbacks
  public onSelectObject?: (obj: DetectedObject | null) => void;
  public onHoverObject?: (obj: DetectedObject | null) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setDetections(detections: DetectedObject[]) {
    this.detections = detections;
    this.renderOverlay();
  }

  public setSelectedObjectId(id: string | null) {
    this.selectedObjectId = id;
    this.renderOverlay();
  }

  public setHoveredObjectId(id: string | null) {
    this.hoveredObjectId = id;
    this.renderOverlay();
  }

  public setActiveCategory(category: string) {
    this.activeCategory = category;
    this.renderOverlay();
  }

  public render(imageUrl: string | null, isAnalyzing: boolean = false) {
    this.container.innerHTML = '';

    if (!imageUrl) {
      this.container.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[460px]">
          <div class="w-20 h-20 rounded-2xl glass-panel-subtle flex items-center justify-center text-cyan-400 mb-4 glow-cyan animate-pulse-slow">
            ${Icons.box}
          </div>
          <h3 class="text-xl font-bold font-display text-white mb-2 tracking-wide">NO ACTIVE TELEMETRY FEED</h3>
          <p class="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
            Upload an image, capture via webcam, or choose one of our high-density sample scenes to initiate universal object grounding.
          </p>
          <div class="flex flex-wrap gap-3 justify-center">
            <button id="workspace-upload-btn" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold text-xs tracking-wider uppercase flex items-center gap-2 hover:opacity-90 transition glow-cyan shadow-lg">
              ${Icons.upload} Upload Image
            </button>
            <button id="workspace-camera-btn" class="px-5 py-2.5 rounded-xl glass-panel text-white font-medium text-xs tracking-wider uppercase flex items-center gap-2 hover:border-cyan-400 transition">
              ${Icons.camera} Live Camera
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Controls toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-cyan-500/20 bg-cyber-900/90 backdrop-blur-md z-30';
    toolbar.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          FEED RESOLUTION: <span id="res-badge" class="ml-1 text-white">...</span>
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
          ZOOM: <span id="zoom-badge" class="ml-1 text-cyan-400 font-bold">${Math.round(this.zoomLevel * 100)}%</span>
        </span>
      </div>

      <div class="flex items-center gap-1.5 sm:gap-2">
        <!-- Visibility Toggles -->
        <button id="toggle-boxes-btn" class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition ${this.options.showBoxes ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700'}" title="Toggle Bounding Boxes">
          ${Icons.layers} Boxes
        </button>
        <button id="toggle-labels-btn" class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition ${this.options.showLabels ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700'}" title="Toggle Object Labels">
          ${Icons.target} Labels
        </button>
        <button id="toggle-conf-btn" class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition ${this.options.showConfidence ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700'}" title="Toggle Confidence Scores">
          ${Icons.sparkles} Conf%
        </button>
        <button id="toggle-split-btn" class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition ${this.options.sideBySide ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700'}" title="Side-by-Side Comparison">
          ${Icons.split} Compare
        </button>

        <div class="h-4 w-[1px] bg-slate-700 mx-1"></div>

        <!-- Zoom Controls -->
        <button id="btn-zoom-in" class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 border border-slate-700 transition" title="Zoom In">
          ${Icons.zoomIn}
        </button>
        <button id="btn-zoom-out" class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 border border-slate-700 transition" title="Zoom Out">
          ${Icons.zoomOut}
        </button>
        <button id="btn-zoom-reset" class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 border border-slate-700 transition" title="Reset Zoom">
          ${Icons.resetZoom}
        </button>
      </div>
    `;

    // Viewport area
    const viewport = document.createElement('div');
    viewport.className = 'relative flex-1 w-full overflow-hidden flex items-center justify-center bg-cyber-950 cyber-grid select-none min-h-[480px] cursor-grab';
    viewport.id = 'workspace-viewport';

    if (this.options.sideBySide) {
      // Split view
      viewport.className += ' grid grid-cols-1 md:grid-cols-2 gap-2 p-2';
      viewport.innerHTML = `
        <div class="relative w-full h-full flex flex-col items-center justify-center border border-slate-800 rounded-xl overflow-hidden bg-black/60">
          <div class="absolute top-2 left-2 z-10 px-2.5 py-1 rounded bg-black/80 text-[10px] font-mono text-slate-400 border border-slate-700">ORIGINAL RAW INPUT</div>
          <img src="${imageUrl}" class="max-w-full max-h-[500px] object-contain rounded" />
        </div>
        <div class="relative w-full h-full flex flex-col items-center justify-center border border-cyan-500/30 rounded-xl overflow-hidden bg-black/60" id="annotated-split-pane">
          <div class="absolute top-2 left-2 z-10 px-2.5 py-1 rounded bg-cyan-950/80 text-[10px] font-mono text-cyan-400 border border-cyan-500/40">GROUNDED TELEMETRY (${this.detections.length} OBJECTS)</div>
          <div id="split-canvas-wrapper" class="relative inline-block"></div>
        </div>
      `;
    } else {
      // Single interactive pane with zoom & pan
      viewport.innerHTML = `
        <div id="transform-stage" class="relative inline-block transition-transform duration-75 origin-center">
          <img id="main-image" src="${imageUrl}" class="block max-h-[72vh] max-w-full w-auto h-auto object-contain pointer-events-none rounded-lg shadow-2xl" />
          <canvas id="detection-canvas" class="absolute top-0 left-0 w-full h-full pointer-events-auto z-10"></canvas>
          ${isAnalyzing ? `<div class="scanline"></div>` : ''}
        </div>
      `;
    }

    this.container.appendChild(toolbar);
    this.container.appendChild(viewport);

    // Setup elements
    this.setupEventListeners(viewport);
  }

  private setupEventListeners(viewport: HTMLElement) {
    // Toolbar buttons
    document.getElementById('toggle-boxes-btn')?.addEventListener('click', () => {
      this.options.showBoxes = !this.options.showBoxes;
      this.render(this.imageElement?.src || null);
    });

    document.getElementById('toggle-labels-btn')?.addEventListener('click', () => {
      this.options.showLabels = !this.options.showLabels;
      this.render(this.imageElement?.src || null);
    });

    document.getElementById('toggle-conf-btn')?.addEventListener('click', () => {
      this.options.showConfidence = !this.options.showConfidence;
      this.render(this.imageElement?.src || null);
    });

    document.getElementById('toggle-split-btn')?.addEventListener('click', () => {
      this.options.sideBySide = !this.options.sideBySide;
      this.render(this.imageElement?.src || null);
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.zoomLevel = Math.min(3.5, this.zoomLevel + 0.25);
      this.applyTransform();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
      this.applyTransform();
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.zoomLevel = 1;
      this.panX = 0;
      this.panY = 0;
      this.applyTransform();
    });

    // Panning & interaction
    if (!this.options.sideBySide) {
      viewport.addEventListener('mousedown', (e) => {
        if (e.button === 0 && (this.zoomLevel > 1 || e.shiftKey)) {
          this.isPanning = true;
          this.startPanX = e.clientX - this.panX;
          this.startPanY = e.clientY - this.panY;
          viewport.classList.add('cursor-grabbing');
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isPanning) return;
        this.panX = e.clientX - this.startPanX;
        this.panY = e.clientY - this.startPanY;
        this.applyTransform();
      });

      window.addEventListener('mouseup', () => {
        this.isPanning = false;
        viewport.classList.remove('cursor-grabbing');
      });

      // Mouse wheel zoom
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        this.zoomLevel = Math.max(0.5, Math.min(3.5, this.zoomLevel + delta));
        this.applyTransform();
      }, { passive: false });
    }

    // Canvas setup
    const img = (document.getElementById('main-image') || document.querySelector('#split-canvas-wrapper img')) as HTMLImageElement;
    const canvas = (document.getElementById('detection-canvas') || document.getElementById('split-canvas')) as HTMLCanvasElement;

    if (img) {
      this.imageElement = img;
      if (img.complete) {
        this.onImageLoaded(img, canvas);
      } else {
        img.onload = () => this.onImageLoaded(img, canvas);
      }
    }
  }

  private onImageLoaded(img: HTMLImageElement, canvas: HTMLCanvasElement | null) {
    const resBadge = document.getElementById('res-badge');
    if (resBadge) {
      resBadge.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
    }

    if (this.options.sideBySide) {
      const splitWrapper = document.getElementById('split-canvas-wrapper');
      if (splitWrapper) {
        splitWrapper.innerHTML = `
          <img src="${img.src}" class="block max-h-[500px] max-w-full w-auto h-auto object-contain rounded" />
          <canvas id="split-canvas" class="absolute top-0 left-0 w-full h-full pointer-events-auto"></canvas>
        `;
        const newCanvas = document.getElementById('split-canvas') as HTMLCanvasElement;
        this.canvasOverlay = newCanvas;
        this.initCanvasInteractions(newCanvas, splitWrapper.querySelector('img')!);
      }
    } else if (canvas) {
      this.canvasOverlay = canvas;
      this.initCanvasInteractions(canvas, img);
    }
  }

  private initCanvasInteractions(canvas: HTMLCanvasElement, img: HTMLImageElement) {
    const updateSize = () => {
      const rect = img.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      this.renderOverlay();
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Hit testing for hover & click
    const getHitObject = (e: MouseEvent): DetectedObject | null => {
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / rect.width; // 0..1
      const clickY = (e.clientY - rect.top) / rect.height; // 0..1

      // Search reverse (top-most box first)
      for (let i = this.detections.length - 1; i >= 0; i--) {
        const d = this.detections[i];
        if (!d.visible) continue;
        const [ymin, xmin, ymax, xmax] = d.box_2d.map(c => c / 1000);
        if (clickX >= xmin && clickX <= xmax && clickY >= ymin && clickY <= ymax) {
          return d;
        }
      }
      return null;
    };

    canvas.addEventListener('mousemove', (e) => {
      const hit = getHitObject(e);
      const newHoverId = hit ? hit.object_id : null;
      if (newHoverId !== this.hoveredObjectId) {
        this.hoveredObjectId = newHoverId;
        this.renderOverlay();
        if (this.onHoverObject) this.onHoverObject(hit);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (this.hoveredObjectId !== null) {
        this.hoveredObjectId = null;
        this.renderOverlay();
        if (this.onHoverObject) this.onHoverObject(null);
      }
    });

    canvas.addEventListener('click', (e) => {
      const hit = getHitObject(e);
      this.selectedObjectId = hit ? (this.selectedObjectId === hit.object_id ? null : hit.object_id) : null;
      this.renderOverlay();
      if (this.onSelectObject) this.onSelectObject(hit);
    });
  }

  private applyTransform() {
    const stage = document.getElementById('transform-stage');
    const zoomBadge = document.getElementById('zoom-badge');
    if (stage) {
      stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    }
    if (zoomBadge) {
      zoomBadge.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  public renderOverlay() {
    if (!this.canvasOverlay) return;
    const ctx = this.canvasOverlay.getContext('2d');
    if (!ctx) return;

    const w = this.canvasOverlay.width;
    const h = this.canvasOverlay.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.options.showBoxes && !this.selectedObjectId && !this.hoveredObjectId) return;

    this.detections.forEach((d) => {
      if (!d.visible) return;

      const isCategoryMatch = this.activeCategory === 'ALL' || d.category.toLowerCase() === this.activeCategory.toLowerCase();
      const isSelected = d.object_id === this.selectedObjectId;
      const isHovered = d.object_id === this.hoveredObjectId;

      const [y0, x0, y1, x1] = d.box_2d.map(c => c / 1000);
      const boxX = x0 * w;
      const boxY = y0 * h;
      const boxW = (x1 - x0) * w;
      const boxH = (y1 - y0) * h;

      const boxColor = d.color || '#00f2fe';

      ctx.save();

      if (!isCategoryMatch && !isSelected && !isHovered) {
        ctx.globalAlpha = 0.2;
      }

      // Box styling
      if (isSelected) {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 3.5;
        ctx.fillStyle = 'rgba(0, 242, 254, 0.22)';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 15;
      } else if (isHovered) {
        ctx.strokeStyle = '#ff6a00';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(255, 106, 0, 0.18)';
        ctx.shadowColor = '#ff6a00';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 1.8;
        ctx.fillStyle = `${boxColor}15`; // ~8% opacity
        ctx.shadowColor = boxColor;
        ctx.shadowBlur = 4;
      }

      // Draw bounding box rectangle
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillRect(boxX, boxY, boxW, boxH);

      // Corner reticles for high-tech look
      const cornerLen = Math.min(12, boxW / 4, boxH / 4);
      ctx.lineWidth = isSelected ? 4 : 2.5;
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(boxX, boxY + cornerLen);
      ctx.lineTo(boxX, boxY);
      ctx.lineTo(boxX + cornerLen, boxY);
      // Top-Right
      ctx.moveTo(boxX + boxW - cornerLen, boxY);
      ctx.lineTo(boxX + boxW, boxY);
      ctx.lineTo(boxX + boxW, boxY + cornerLen);
      // Bottom-Left
      ctx.moveTo(boxX, boxY + boxH - cornerLen);
      ctx.lineTo(boxX, boxY + boxH);
      ctx.lineTo(boxX + cornerLen, boxY + boxH);
      // Bottom-Right
      ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
      ctx.lineTo(boxX + boxW, boxY + boxH);
      ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
      ctx.stroke();

      // Render Label Tag
      if (this.options.showLabels || isSelected || isHovered) {
        let labelText = d.label;
        if (this.options.showConfidence) {
          labelText += ` • ${(d.confidence * 100).toFixed(0)}%`;
        }

        ctx.font = '600 11px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(labelText);
        const textW = textMetrics.width + 12;
        const textH = 18;

        // Keep label inside visible bounds
        let tagX = boxX;
        let tagY = boxY - textH - 2;
        if (tagY < 0) tagY = boxY + 2; // place inside box if near top
        if (tagX + textW > w) tagX = w - textW - 2;
        if (tagX < 0) tagX = 2;

        // Tag Background
        ctx.shadowBlur = 0;
        ctx.fillStyle = isSelected ? '#00f2fe' : isHovered ? '#ff6a00' : 'rgba(3, 7, 18, 0.9)';
        ctx.fillRect(tagX, tagY, textW, textH);

        // Tag border
        ctx.strokeStyle = isSelected ? '#ffffff' : boxColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX, tagY, textW, textH);

        // Tag Text
        ctx.fillStyle = isSelected || isHovered ? '#000000' : '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, tagX + 6, tagY + textH / 2);
      }

      ctx.restore();
    });
  }

  public exportAnnotatedCanvas(): HTMLCanvasElement | null {
    if (!this.imageElement) return null;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.imageElement.naturalWidth;
    exportCanvas.height = this.imageElement.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    // Draw full-resolution source image
    ctx.drawImage(this.imageElement, 0, 0);

    const w = exportCanvas.width;
    const h = exportCanvas.height;

    // Scale font size proportionally for high-res images
    const baseFontSize = Math.max(12, Math.round(w / 80));
    ctx.font = `600 ${baseFontSize}px "JetBrains Mono", monospace`;

    this.detections.forEach((d) => {
      if (!d.visible) return;
      const [y0, x0, y1, x1] = d.box_2d.map(c => c / 1000);
      const boxX = x0 * w;
      const boxY = y0 * h;
      const boxW = (x1 - x0) * w;
      const boxH = (y1 - y0) * h;
      const boxColor = d.color || '#00f2fe';

      ctx.save();
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = Math.max(2, Math.round(w / 400));
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = `${boxColor}22`;
      ctx.fillRect(boxX, boxY, boxW, boxH);

      // Draw label badge
      const labelText = `${d.label} • ${(d.confidence * 100).toFixed(0)}%`;
      const textMetrics = ctx.measureText(labelText);
      const padding = Math.round(baseFontSize * 0.4);
      const textW = textMetrics.width + padding * 2;
      const textH = baseFontSize + padding * 1.5;

      let tagX = boxX;
      let tagY = boxY - textH - 2;
      if (tagY < 0) tagY = boxY + 2;

      ctx.fillStyle = 'rgba(3, 7, 18, 0.92)';
      ctx.fillRect(tagX, tagY, textW, textH);
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(tagX, tagY, textW, textH);

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, tagX + padding, tagY + textH / 2);
      ctx.restore();
    });

    return exportCanvas;
  }
}
