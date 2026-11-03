import { Icons } from '../utils/icons';

export class CameraModal {
  private container: HTMLElement;
  private stream: MediaStream | null = null;
  private currentFacing: 'user' | 'environment' = 'environment';
  private videoElement: HTMLVideoElement | null = null;

  public onCapture?: (base64Image: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public open() {
    this.container.classList.remove('hidden');
    this.render();
    this.startCamera();
  }

  public close() {
    this.stopCamera();
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }

  private async startCamera() {
    try {
      this.stopCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.currentFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      const errorMsg = document.getElementById('camera-error-msg');
      if (errorMsg) {
        errorMsg.classList.remove('hidden');
        errorMsg.textContent = `Camera Access Failed: ${err.message || 'Permission denied or no webcam available.'}`;
      }
    }
  }

  private stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  private switchFacing() {
    this.currentFacing = this.currentFacing === 'environment' ? 'user' : 'environment';
    this.startCamera();
  }

  private captureFrame() {
    if (!this.videoElement || !this.videoElement.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(this.videoElement, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    this.close();
    this.onCapture?.(base64);
  }

  public render() {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <div class="relative w-full max-w-2xl glass-panel rounded-3xl border border-cyan-500/40 overflow-hidden shadow-2xl flex flex-col">
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-cyber-950/80">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 glow-cyan animate-pulse"></span>
              <h3 class="text-sm font-mono font-bold uppercase tracking-wider text-white">LIVE OPTICAL SENSOR CAPTURE</h3>
            </div>
            <button id="close-camera-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
              ${Icons.close}
            </button>
          </div>

          <!-- Video Viewfinder -->
          <div class="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
            <video id="camera-video-feed" autoplay playsinline muted class="w-full h-full object-cover"></video>

            <!-- Viewfinder Overlay Reticles -->
            <div class="absolute inset-4 pointer-events-none border border-cyan-500/20 rounded-2xl flex flex-col justify-between p-4">
              <div class="flex justify-between items-start">
                <span class="text-[10px] font-mono text-cyan-400 bg-black/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  OPTICAL FEED • SENSOR READY
                </span>
                <span class="text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded border border-slate-800">
                  ${this.currentFacing.toUpperCase()}
                </span>
              </div>
              <div class="flex justify-center items-center">
                <div class="w-16 h-16 border border-cyan-400/40 rounded-full flex items-center justify-center animate-pulse">
                  <div class="w-2 h-2 bg-cyan-400 rounded-full"></div>
                </div>
              </div>
              <div class="flex justify-between items-end text-[10px] font-mono text-slate-500">
                <span>COORD: [0, 0]</span>
                <span>ISO: AUTO • RES: FHD</span>
              </div>
            </div>

            <!-- Error banner -->
            <div id="camera-error-msg" class="hidden absolute inset-0 bg-cyber-950/90 flex items-center justify-center p-6 text-center text-xs font-mono text-red-400"></div>
          </div>

          <!-- Modal Controls Footer -->
          <div class="flex items-center justify-between px-6 py-4 bg-cyber-950/80 border-t border-slate-800">
            <button id="camera-switch-btn" class="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-2 transition border border-slate-700">
              ${Icons.switchCamera} Switch Camera
            </button>

            <button id="camera-capture-trigger" class="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:opacity-90 transition glow-cyan">
              ${Icons.camera} Snap & Detect
            </button>
          </div>
        </div>
      </div>
    `;

    this.videoElement = document.getElementById('camera-video-feed') as HTMLVideoElement;

    document.getElementById('close-camera-modal')?.addEventListener('click', () => this.close());
    document.getElementById('camera-switch-btn')?.addEventListener('click', () => this.switchFacing());
    document.getElementById('camera-capture-trigger')?.addEventListener('click', () => this.captureFrame());
  }
}
