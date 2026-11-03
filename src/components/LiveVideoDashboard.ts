import { Icons } from '../utils/icons';
import { ApiService } from '../services/apiService';
import { VideoTracker } from '../services/videoTracker';
import { VideoAnalysisService } from '../services/videoAnalysisService';
import { TrackedObject, VideoAnalysisResult, VideoRecordingState, DetectionMode } from '../types';
import { getCategoryColor } from '../constants';

export class LiveVideoDashboard {
  private container: HTMLElement;
  private tracker: VideoTracker;

  // Media streams
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private rawVideoBlob: Blob | null = null;
  private videoDevices: MediaDeviceInfo[] = [];
  private selectedDeviceId: string = '';
  private currentFacingMode: 'user' | 'environment' = 'environment';

  // Recording State & Timer
  private recordingState: VideoRecordingState = 'idle';
  private recordingStartTime: number = 0;
  private pausedTimeAccumulated: number = 0;
  private pauseStartedAt: number = 0;
  private timerInterval: any = null;
  private elapsedSeconds: number = 0;
  private readonly MIN_RECORDING_SECONDS: number = 30.0;

  // Real-time Detection Loop
  private isDetecting: boolean = false;
  private isDetectionLoopRunning: boolean = false;
  private liveFps: number = 0;
  private lastFpsTime: number = performance.now();
  private frameCount: number = 0;
  private lastInferenceLatencyMs: number = 0;
  private animFrameId: number | null = null;
  private detectionMode: DetectionMode = 'all';

  // Keyframes sampled during recording
  private sampledKeyframes: { timestamp: number; imageBase64: string }[] = [];

  // Post-recording Analysis
  private analysisResult: VideoAnalysisResult | null = null;
  private isExportingAnnotated: boolean = false;
  private exportProgress: number = 0;

  // AI Video Q&A Assistant
  private videoChatHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  private isAiThinking: boolean = false;

  // DOM elements
  private videoEl!: HTMLVideoElement;
  private canvasEl!: HTMLCanvasElement;
  private captureCanvas!: HTMLCanvasElement;
  private postRecordVideoEl!: HTMLVideoElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.tracker = new VideoTracker();
    this.captureCanvas = document.createElement('canvas');
  }

  public async init() {
    this.render();
    await this.enumerateCameras();
    await this.startCamera();
    this.startLiveAnimationLoop();
  }

  public destroy() {
    this.stopDetectionLoop();
    this.stopCamera();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private async enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(d => d.kind === 'videoinput');
      const select = document.getElementById('camera-select-dropdown') as HTMLSelectElement;
      if (select && this.videoDevices.length > 0) {
        select.innerHTML = this.videoDevices
          .map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`)
          .join('');
        this.selectedDeviceId = this.videoDevices[0].deviceId;
      }
    } catch (err) {
      console.warn('Could not enumerate video devices:', err);
    }
  }

  private async startCamera() {
    this.stopCamera();
    const errorBanner = document.getElementById('camera-error-banner');
    if (errorBanner) errorBanner.classList.add('hidden');

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: this.selectedDeviceId
          ? { deviceId: { exact: this.selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: this.currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoEl) {
        this.videoEl.srcObject = this.mediaStream;
        await this.videoEl.play();
      }

      this.startDetectionLoop();
    } catch (err: any) {
      console.error('Failed to access camera:', err);
      if (errorBanner) {
        errorBanner.classList.remove('hidden');
        errorBanner.innerHTML = `
          <div class="flex items-center gap-2 text-rose-400 font-mono text-xs">
            ${Icons.close}
            <span>Camera Access Notice: ${err.name === 'NotAllowedError' ? 'Permission denied. Please grant camera access in browser settings.' : err.message || 'Camera device not available.'}</span>
          </div>
          <button id="retry-camera-btn" class="mt-2 px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono hover:bg-rose-500/30">
            Retry Camera Access
          </button>
        `;
        document.getElementById('retry-camera-btn')?.addEventListener('click', () => this.startCamera());
      }
    }
  }

  private stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  private switchFacingMode() {
    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    this.selectedDeviceId = '';
    this.startCamera();
  }

  /**
   * Continuous AI frame detection loop: grabs frame, queries /api/detect, updates tracker
   */
  private startDetectionLoop() {
    this.isDetectionLoopRunning = true;
    this.runDetectionCycle();
  }

  private stopDetectionLoop() {
    this.isDetectionLoopRunning = false;
  }

  private async runDetectionCycle() {
    if (!this.isDetectionLoopRunning) return;

    if (!this.isDetecting && this.videoEl && this.videoEl.readyState >= 2 && !this.videoEl.paused) {
      this.isDetecting = true;
      const startTime = performance.now();

      try {
        const frameBase64 = this.captureCurrentFrameBase64(800);
        if (frameBase64) {
          const res = await ApiService.detectObjects(frameBase64, this.detectionMode, 'balanced');
          this.lastInferenceLatencyMs = Math.round(performance.now() - startTime);

          if (res.success && Array.isArray(res.detections)) {
            const currentTimestampSec = this.recordingState === 'recording'
              ? this.elapsedSeconds
              : (performance.now() - this.recordingStartTime) / 1000;

            this.tracker.update(res.detections, currentTimestampSec);
            this.updateLiveTelemetryUi();

            // Store keyframe if recording
            if (this.recordingState === 'recording') {
              if (this.sampledKeyframes.length === 0 || this.elapsedSeconds - this.sampledKeyframes[this.sampledKeyframes.length - 1].timestamp >= 4.0) {
                this.sampledKeyframes.push({
                  timestamp: this.elapsedSeconds,
                  imageBase64: frameBase64,
                });
              }
            }
          }
        }
      } catch (err) {
        // Continue detection loop even on transient network hiccups
        console.warn('Live detection cycle notice:', err);
      } finally {
        this.isDetecting = false;
      }
    }

    // Schedule next frame detection with quota-preserving pace (2.5s interval)
    // The visual tracker continues smooth 60 FPS motion prediction between AI keyframes
    if (this.isDetectionLoopRunning) {
      setTimeout(() => this.runDetectionCycle(), 2500);
    }
  }

  private captureCurrentFrameBase64(maxDimension: number = 800): string | null {
    if (!this.videoEl || !this.videoEl.videoWidth || !this.videoEl.videoHeight) return null;

    const vw = this.videoEl.videoWidth;
    const vh = this.videoEl.videoHeight;
    const scale = Math.min(1, maxDimension / Math.max(vw, vh));

    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    this.captureCanvas.width = w;
    this.captureCanvas.height = h;
    const ctx = this.captureCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(this.videoEl, 0, 0, w, h);
    return this.captureCanvas.toDataURL('image/jpeg', 0.82);
  }

  /**
   * 60 FPS smooth rendering loop: interpolates boxes and draws neon reticles
   */
  private startLiveAnimationLoop() {
    const loop = () => {
      this.tracker.stepFrame(0.25);
      this.renderOverlayCanvas();

      // FPS tracking
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.liveFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
        this.frameCount = 0;
        this.lastFpsTime = now;
        const fpsEl = document.getElementById('live-fps-val');
        if (fpsEl) fpsEl.textContent = `${this.liveFps} FPS`;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private renderOverlayCanvas() {
    if (!this.canvasEl || !this.videoEl) return;
    const rect = this.videoEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (this.canvasEl.width !== rect.width || this.canvasEl.height !== rect.height) {
      this.canvasEl.width = rect.width;
      this.canvasEl.height = rect.height;
    }

    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    const width = this.canvasEl.width;
    const height = this.canvasEl.height;
    const activeTracks = this.tracker.getActiveTracks();

    // Draw trajectory trails & bounding boxes
    activeTracks.forEach(track => {
      const [ymin, xmin, ymax, xmax] = track.box_2d;
      const x = (xmin / 1000) * width;
      const y = (ymin / 1000) * height;
      const w = ((xmax - xmin) / 1000) * width;
      const h = ((ymax - ymin) / 1000) * height;
      const color = track.color || '#00f2fe';

      // 1. Draw Trajectory motion trail
      if (track.trajectory.length > 1) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < track.trajectory.length; i++) {
          const p = track.trajectory[i];
          const px = (p.x / 1000) * width;
          const py = (p.y / 1000) * height;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();

        // Pulsing dot at center
        const lastP = track.trajectory[track.trajectory.length - 1];
        ctx.beginPath();
        ctx.arc((lastP.x / 1000) * width, (lastP.y / 1000) * height, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.restore();
      }

      // 2. Cyber Bounding Box
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(x, y, w, h);

      // Corner brackets
      const bLen = Math.min(w, h, 24) * 0.35;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // TL
      ctx.moveTo(x, y + bLen); ctx.lineTo(x, y); ctx.lineTo(x + bLen, y);
      // TR
      ctx.moveTo(x + w - bLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bLen);
      // BL
      ctx.moveTo(x, y + h - bLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bLen, y + h);
      // BR
      ctx.moveTo(x + w - bLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bLen);
      ctx.stroke();

      // 3. Label Pill
      const fontSize = Math.max(10, Math.min(13, Math.round(width / 60)));
      ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
      const speed = Math.hypot(track.velocity.vx, track.velocity.vy);
      const speedStr = speed > 15 ? ` • ${Math.round(speed / 10)}m/s` : '';
      const text = `${track.tracking_id} ${track.label.toUpperCase()} ${(track.confidence * 100).toFixed(0)}%${speedStr}`;

      const metrics = ctx.measureText(text);
      const pillW = metrics.width + 12;
      const pillH = fontSize + 8;
      const pillY = Math.max(0, y - pillH - 2);

      ctx.fillStyle = 'rgba(5, 11, 20, 0.9)';
      ctx.fillRect(x, pillY, pillW, pillH);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, pillY, pillW, pillH);

      ctx.fillStyle = color;
      ctx.fillText(text, x + 6, pillY + fontSize + 1);

      ctx.restore();
    });
  }

  // -------------------------------------------------------------
  // RECORDING WORKFLOW & MINIMUM 30-SECOND TIMER VALIDATION
  // -------------------------------------------------------------

  public startRecording() {
    if (!this.mediaStream) {
      alert('Camera stream is not active. Please ensure camera access is granted.');
      return;
    }

    this.recordedChunks = [];
    this.rawVideoBlob = null;
    this.sampledKeyframes = [];
    this.tracker.reset();

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
    } catch {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
    }

    this.mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.rawVideoBlob = new Blob(this.recordedChunks, { type: mimeType });
      this.handleRecordingFinished();
    };

    this.mediaRecorder.start(250);
    this.recordingState = 'recording';
    this.recordingStartTime = performance.now();
    this.pausedTimeAccumulated = 0;
    this.elapsedSeconds = 0;

    this.startTimerInterval();
    this.updateControlsUi();
  }

  public pauseRecording() {
    if (this.recordingState !== 'recording' || !this.mediaRecorder) return;
    this.mediaRecorder.pause();
    this.recordingState = 'paused';
    this.pauseStartedAt = performance.now();
    this.updateControlsUi();
  }

  public resumeRecording() {
    if (this.recordingState !== 'paused' || !this.mediaRecorder) return;
    this.mediaRecorder.resume();
    this.recordingState = 'recording';
    this.pausedTimeAccumulated += performance.now() - this.pauseStartedAt;
    this.updateControlsUi();
  }

  public stopRecording() {
    // ENFORCE STRICT 30-SECOND MINIMUM VALIDATION
    if (this.elapsedSeconds < this.MIN_RECORDING_SECONDS) {
      console.warn(`Stop blocked: recording duration is ${this.elapsedSeconds.toFixed(1)}s (min ${this.MIN_RECORDING_SECONDS}s required)`);
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.recordingState = 'stopped';
    this.updateControlsUi();
  }

  public restartRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.startRecording();
  }

  private startTimerInterval() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.recordingState === 'recording') {
        const now = performance.now();
        this.elapsedSeconds = (now - this.recordingStartTime - this.pausedTimeAccumulated) / 1000;
        this.updateTimerUi();
      }
    }, 100);
  }

  private updateTimerUi() {
    const timerTextEl = document.getElementById('record-timer-text');
    const progressBar = document.getElementById('record-progress-bar');
    const stopBtn = document.getElementById('video-stop-btn') as HTMLButtonElement;
    const minNotice = document.getElementById('min-duration-notice');

    const curM = Math.floor(this.elapsedSeconds / 60);
    const curS = Math.floor(this.elapsedSeconds % 60);
    const curStr = `${String(curM).padStart(2, '0')}:${String(curS).padStart(2, '0')}`;
    const minStr = `00:${Math.round(this.MIN_RECORDING_SECONDS)}`;

    if (timerTextEl) {
      timerTextEl.textContent = `${curStr} / ${minStr}`;
    }

    // Progress percentage against 30s minimum
    const pct = Math.min(100, (this.elapsedSeconds / this.MIN_RECORDING_SECONDS) * 100);
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
      if (this.elapsedSeconds >= this.MIN_RECORDING_SECONDS) {
        progressBar.classList.remove('bg-amber-400');
        progressBar.classList.add('bg-emerald-400', 'shadow-lg', 'shadow-emerald-500/50');
      } else {
        progressBar.classList.remove('bg-emerald-400', 'shadow-lg');
        progressBar.classList.add('bg-amber-400');
      }
    }

    // Check 30-second minimum condition
    if (stopBtn) {
      if (this.elapsedSeconds < this.MIN_RECORDING_SECONDS) {
        stopBtn.disabled = true;
        stopBtn.classList.add('opacity-40', 'cursor-not-allowed', 'bg-slate-800', 'border-slate-700', 'text-slate-500');
        stopBtn.classList.remove('bg-rose-500', 'hover:bg-rose-400', 'text-white', 'border-rose-400', 'glow-rose');
        if (minNotice) {
          const remaining = Math.ceil(this.MIN_RECORDING_SECONDS - this.elapsedSeconds);
          minNotice.textContent = `REC LOCKED: RECORDING MINIMUM OF 30 SECONDS REQUIRED (${remaining}s remaining)`;
          minNotice.className = 'text-[11px] font-mono text-amber-400 font-bold tracking-wide flex items-center gap-1.5 animate-pulse';
        }
      } else {
        stopBtn.disabled = false;
        stopBtn.classList.remove('opacity-40', 'cursor-not-allowed', 'bg-slate-800', 'border-slate-700', 'text-slate-500');
        stopBtn.classList.add('bg-rose-500', 'hover:bg-rose-400', 'text-white', 'border-rose-400', 'shadow-lg', 'shadow-rose-500/50');
        if (minNotice) {
          minNotice.textContent = `● MINIMUM 30s REACHED — YOU CAN STOP NOW OR CONTINUE RECORDING FOR LONGER`;
          minNotice.className = 'text-[11px] font-mono text-emerald-400 font-bold tracking-wide flex items-center gap-1.5';
        }
      }
    }
  }

  private handleRecordingFinished() {
    const allTracks = this.tracker.getAllTracks();
    this.analysisResult = VideoAnalysisService.generateAnalysis(allTracks, this.elapsedSeconds);

    // Switch view to Post-Recording Review
    this.showPostRecordingView();
  }

  private showPostRecordingView() {
    const liveSection = document.getElementById('live-feed-section');
    const postSection = document.getElementById('post-recording-section');

    if (liveSection) liveSection.classList.add('hidden');
    if (postSection) postSection.classList.remove('hidden');

    this.postRecordVideoEl = document.getElementById('post-video-player') as HTMLVideoElement;
    if (this.postRecordVideoEl && this.rawVideoBlob) {
      this.postRecordVideoEl.src = URL.createObjectURL(this.rawVideoBlob);
    }

    this.renderAnalysisTelemetry();
    this.renderTimelineScrubber();
    this.renderPostTrackList();
    this.seedVideoAiPrompt();
  }

  public resetToLiveCapture() {
    const liveSection = document.getElementById('live-feed-section');
    const postSection = document.getElementById('post-recording-section');

    if (liveSection) liveSection.classList.remove('hidden');
    if (postSection) postSection.classList.add('hidden');

    this.recordingState = 'idle';
    this.elapsedSeconds = 0;
    this.tracker.reset();
    this.analysisResult = null;
    this.rawVideoBlob = null;
    this.updateControlsUi();
  }

  // -------------------------------------------------------------
  // POST-RECORDING ACTIONS & EXPORTS
  // -------------------------------------------------------------

  public downloadRawVideo() {
    if (!this.rawVideoBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.rawVideoBlob);
    a.download = `visual_algo_raw_${Date.now()}.webm`;
    a.click();
  }

  public async exportAnnotatedVideo() {
    if (!this.rawVideoBlob || !this.analysisResult || this.isExportingAnnotated) return;
    this.isExportingAnnotated = true;
    const btn = document.getElementById('export-annotated-btn') as HTMLButtonElement;
    const statusText = document.getElementById('export-status-text');

    if (btn) btn.disabled = true;

    try {
      if (statusText) statusText.textContent = 'Rendering telemetry HUD & bounding boxes into video... 0%';

      const annotatedBlob = await VideoAnalysisService.renderAnnotatedVideo(
        this.rawVideoBlob,
        this.analysisResult.tracks,
        this.analysisResult.duration_seconds,
        progress => {
          this.exportProgress = progress;
          if (statusText) statusText.textContent = `Burning annotations into video frames: ${progress}%`;
        }
      );

      if (statusText) statusText.textContent = 'Complete! Triggering download...';

      const a = document.createElement('a');
      a.href = URL.createObjectURL(annotatedBlob);
      a.download = `visual_algo_annotated_${Date.now()}.webm`;
      a.click();
    } catch (err: any) {
      console.error('Annotated video export error:', err);
      if (statusText) statusText.textContent = `Export failed: ${err.message || 'Browser video encoder error'}`;
    } finally {
      this.isExportingAnnotated = false;
      if (btn) btn.disabled = false;
      setTimeout(() => {
        if (statusText) statusText.textContent = '';
      }, 5000);
    }
  }

  public downloadTelemetryJson() {
    if (!this.analysisResult) return;
    const jsonStr = VideoAnalysisService.exportTelemetryJson(this.analysisResult);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `visual_algo_telemetry_${Date.now()}.json`;
    a.click();
  }

  public downloadTrackingCsv() {
    if (!this.analysisResult) return;
    const csvStr = VideoAnalysisService.exportTrackingCsv(this.analysisResult);
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `visual_algo_tracking_${Date.now()}.csv`;
    a.click();
  }

  // -------------------------------------------------------------
  // AI VIDEO ASSISTANT (CONVERSATIONAL GROUNDING ON RECORDED VIDEO)
  // -------------------------------------------------------------

  private seedVideoAiPrompt() {
    this.videoChatHistory = [
      {
        role: 'assistant',
        content: `I've analyzed your **${this.analysisResult?.duration_seconds.toFixed(1)}s** video recording. 
Detected **${this.analysisResult?.total_unique_tracks}** unique tracked entities across **${Object.keys(this.analysisResult?.category_distribution || {}).length}** categories.

You can ask me questions such as:
- *"Summarize the scene and key object movements."*
- *"Which object entered first or stayed visible the longest?"*
- *"List all people and vehicle tracks with timestamps."*`,
      },
    ];
    this.renderVideoChatMessages();
  }

  private renderVideoChatMessages() {
    const list = document.getElementById('video-chat-messages');
    if (!list) return;

    list.innerHTML = this.videoChatHistory
      .map(
        msg => `
        <div class="flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}">
          <span class="text-[10px] font-mono uppercase text-slate-500">${msg.role === 'user' ? 'Operator' : 'Visual Algo AI'}</span>
          <div class="max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
            msg.role === 'user'
              ? 'bg-cyan-500 text-black font-medium'
              : 'glass-panel border border-cyan-500/20 text-slate-200'
          }">
            ${msg.content.replace(/\n/g, '<br/>')}
          </div>
        </div>
      `
      )
      .join('');

    list.scrollTop = list.scrollHeight;
  }

  public async askVideoQuestion(question: string) {
    if (!question.trim() || this.isAiThinking || !this.analysisResult) return;

    this.videoChatHistory.push({ role: 'user', content: question });
    this.renderVideoChatMessages();

    this.isAiThinking = true;
    const sendBtn = document.getElementById('video-chat-send-btn') as HTMLButtonElement;
    if (sendBtn) sendBtn.disabled = true;

    try {
      // Pick best keyframe sample
      const sampleKeyframe = this.sampledKeyframes.length > 0
        ? this.sampledKeyframes[Math.floor(this.sampledKeyframes.length / 2)].imageBase64
        : undefined;

      // Construct timeline summary context
      const timelineSummary = `Video Recording Telemetry:
Duration: ${this.analysisResult.duration_seconds.toFixed(1)} seconds
Total Unique Objects: ${this.analysisResult.total_unique_tracks}
Peak Simultaneous Objects: ${this.analysisResult.peak_simultaneous_objects}
Category Breakdown: ${JSON.stringify(this.analysisResult.category_distribution)}
Timeline Events:
${this.analysisResult.timeline_events.map(e => `[${e.timestamp.toFixed(1)}s] ${e.description}`).join('\n')}
Track Trajectories:
${this.analysisResult.tracks.map(t => `- [${t.tracking_id}] ${t.label} (${t.category}, ${(t.confidence * 100).toFixed(0)}%): first seen ${t.first_seen_time.toFixed(1)}s, last seen ${t.last_seen_time.toFixed(1)}s, speed: dx=${Math.round(t.velocity.vx)}, dy=${Math.round(t.velocity.vy)}`).join('\n')}
`;

      const res = await ApiService.askVisualAssistant(
        `[VIDEO ANALYSIS QUERY]\n${question}`,
        sampleKeyframe,
        this.videoChatHistory.map(m => ({ id: Math.random().toString(), role: m.role, content: m.content, timestamp: '' })),
        [],
        timelineSummary
      );

      this.videoChatHistory.push({
        role: 'assistant',
        content: res.answer || 'No response generated.',
      });
    } catch (err: any) {
      this.videoChatHistory.push({
        role: 'assistant',
        content: `Sorry, could not answer inquiry: ${err.message}`,
      });
    } finally {
      this.isAiThinking = false;
      if (sendBtn) sendBtn.disabled = false;
      this.renderVideoChatMessages();
    }
  }

  // -------------------------------------------------------------
  // UI RENDERING & COMPONENT HTML
  // -------------------------------------------------------------

  public render() {
    this.container.innerHTML = `
      <div class="flex-1 flex flex-col gap-4 max-w-[1720px] w-full mx-auto p-2 sm:p-4 pb-24">
        
        <!-- Live Video Viewport & Controls Section -->
        <div id="live-feed-section" class="flex flex-col lg:flex-row gap-4">
          <!-- Main Camera Video Feed with Overlay -->
          <div class="flex-1 flex flex-col glass-panel rounded-2xl sm:rounded-3xl border border-cyan-500/20 overflow-hidden shadow-2xl relative min-h-[500px]">
            
            <!-- Video Top Telemetry Bar -->
            <div class="p-3 sm:px-5 border-b border-cyan-500/20 bg-cyber-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 z-10">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full ${this.recordingState === 'recording' ? 'bg-rose-500 animate-ping' : 'bg-cyan-400 glow-cyan'}"></span>
                  <span class="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    ${this.recordingState === 'recording' ? 'LIVE RECORDING' : 'LIVE CAMERA STREAM'}
                  </span>
                </div>
                <div class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cyber-900 border border-slate-800 text-[11px] font-mono text-cyan-400">
                  <span id="live-fps-val">-- FPS</span>
                  <span class="text-slate-600">|</span>
                  <span id="live-latency-val">~${this.lastInferenceLatencyMs || 380}ms Latency</span>
                </div>
              </div>

              <!-- Camera Select & Switchers -->
              <div class="flex items-center gap-2">
                <select id="camera-select-dropdown" class="px-2.5 py-1.5 rounded-xl bg-cyber-900 border border-slate-700 text-slate-200 text-xs font-mono focus:border-cyan-400 outline-none max-w-[160px] truncate">
                  <option value="">Default Camera</option>
                </select>
                <button id="switch-camera-facing-btn" class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 hover:border-cyan-400 transition text-xs font-mono flex items-center gap-1.5" title="Flip Camera Facing">
                  ${Icons.switchCamera}
                  <span class="hidden sm:inline">Flip</span>
                </button>
              </div>
            </div>

            <!-- Camera Error Banner -->
            <div id="camera-error-banner" class="hidden m-4 p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-center"></div>

            <!-- Video & Canvas Overlay Stage -->
            <div class="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[420px]">
              <video id="live-camera-video" playsinline muted autoplay class="w-full h-full object-contain pointer-events-none"></video>
              <canvas id="live-tracking-canvas" class="absolute inset-0 w-full h-full pointer-events-none z-10"></canvas>
            </div>

            <!-- Bottom Floating Recording Dock (Enforces >= 30s) -->
            <div class="p-3 sm:p-4 border-t border-cyan-500/20 bg-cyber-950/90 backdrop-blur-md flex flex-col gap-2.5 z-20">
              
              <!-- Timer Progress Bar & Timecode -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span id="record-timer-text" class="text-sm sm:text-base font-mono font-bold text-white tracking-wider">
                      00:00 / 00:30
                    </span>
                    <span class="text-[10px] font-mono text-slate-400 uppercase">(MIN 30 SECONDS REQUIRED)</span>
                  </div>
                  <div id="min-duration-notice" class="text-[11px] font-mono text-amber-400 font-bold tracking-wide">
                    READY TO RECORD
                  </div>
                </div>

                <!-- Progress Bar Container -->
                <div class="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative">
                  <div id="record-progress-bar" class="h-full bg-amber-400 transition-all duration-200" style="width: 0%;"></div>
                </div>
              </div>

              <!-- Button Controls Row -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div class="flex items-center gap-2">
                  <!-- Start Recording Button -->
                  <button id="video-start-btn" class="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition shadow-lg shadow-rose-600/30">
                    ${Icons.record}
                    <span>Start Recording</span>
                  </button>

                  <!-- Pause / Resume Button -->
                  <button id="video-pause-btn" class="hidden px-3 py-2 rounded-xl glass-panel text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1.5 transition">
                    ${Icons.pause}
                    <span>Pause</span>
                  </button>

                  <!-- Stop Recording Button (Strictly Disabled until 30s) -->
                  <button id="video-stop-btn" disabled class="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 opacity-40 cursor-not-allowed font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition" title="Recording must reach 30 seconds minimum">
                    ${Icons.stop}
                    <span>Stop Recording</span>
                  </button>

                  <!-- Restart Recording Button -->
                  <button id="video-restart-btn" class="hidden px-3 py-2 rounded-xl glass-panel text-slate-400 hover:text-white font-mono text-xs flex items-center gap-1.5 transition">
                    ${Icons.restart}
                    <span>Restart</span>
                  </button>
                </div>

                <!-- Mode Select Chips -->
                <div class="flex items-center gap-1.5">
                  <span class="hidden md:inline text-[10px] font-mono text-slate-400 uppercase">Detection Mode:</span>
                  <button class="mode-pill px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition bg-cyan-500 text-black" data-mode="all">ALL</button>
                  <button class="mode-pill px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white glass-panel" data-mode="people">PEOPLE</button>
                  <button class="mode-pill px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white glass-panel" data-mode="vehicles">VEHICLES</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Live Telemetry & Active Tracks Sidebar -->
          <div class="w-full lg:w-96 xl:w-[420px] flex flex-col glass-panel rounded-2xl sm:rounded-3xl border border-cyan-500/20 overflow-hidden shadow-2xl h-[560px] lg:h-auto">
            <div class="p-4 border-b border-cyan-500/20 bg-cyber-950/80 flex items-center justify-between">
              <span class="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                ACTIVE OBJECT TRACKING
              </span>
              <span id="sidebar-tracks-count" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                0 ACTIVE
              </span>
            </div>

            <!-- Stats Bar -->
            <div class="grid grid-cols-2 p-3 gap-2 border-b border-cyan-500/10 bg-cyber-900/40 text-center font-mono">
              <div class="p-2 rounded-xl bg-cyber-950 border border-slate-800">
                <span class="text-[10px] text-slate-400 uppercase block">Active In View</span>
                <span id="stat-active-count" class="text-lg font-bold text-cyan-400">0</span>
              </div>
              <div class="p-2 rounded-xl bg-cyber-950 border border-slate-800">
                <span class="text-[10px] text-slate-400 uppercase block">Total Tracked</span>
                <span id="stat-total-count" class="text-lg font-bold text-orange-400">0</span>
              </div>
            </div>

            <!-- Active Tracked Entities List -->
            <div class="flex-1 overflow-y-auto p-3 space-y-2" id="live-active-tracks-list">
              <div class="text-center py-12 text-slate-500 font-mono text-xs">
                Camera active. Point at people, objects, or vehicles to begin tracking telemetry.
              </div>
            </div>
          </div>
        </div>

        <!-- Post-Recording Review & Analysis Section (Revealed when recording finishes) -->
        <div id="post-recording-section" class="hidden flex flex-col gap-4">
          
          <!-- Top Notice & Reset Header -->
          <div class="glass-panel rounded-2xl p-4 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 bg-cyber-900/80">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center glow-cyan">
                ${Icons.check}
              </div>
              <div>
                <h2 class="text-base font-bold font-display text-white">RECORDING COMPLETED & TELEMETRY COMPILED</h2>
                <p id="post-summary-duration" class="text-xs font-mono text-slate-300">Recorded 30+ seconds video stream with persistent object trajectories.</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button id="post-record-again-btn" class="px-3.5 py-2 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 hover:border-cyan-400 font-mono text-xs flex items-center gap-1.5 transition">
                ${Icons.restart}
                <span>Record New Video</span>
              </button>
            </div>
          </div>

          <!-- Video Player & Export Hub Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <!-- Recorded Video Playback with Scrubber -->
            <div class="lg:col-span-2 glass-panel rounded-2xl sm:rounded-3xl border border-cyan-500/20 overflow-hidden shadow-2xl flex flex-col">
              <div class="p-3 border-b border-cyan-500/20 bg-cyber-950/80 flex items-center justify-between">
                <span class="text-xs font-mono font-bold uppercase text-cyan-400">RECORDED VIDEO PLAYBACK</span>
                <span id="post-video-time" class="text-xs font-mono text-slate-400">00:00 / 00:00</span>
              </div>
              
              <div class="relative bg-black flex items-center justify-center min-h-[380px]">
                <video id="post-video-player" controls playsinline class="w-full max-h-[460px] object-contain"></video>
              </div>

              <!-- Interactive Timeline Scrubber -->
              <div class="p-4 border-t border-cyan-500/20 bg-cyber-950/90 flex flex-col gap-2">
                <span class="text-[11px] font-mono text-slate-400 uppercase">OBJECT PRESENCE TIMELINE (Click marker to jump)</span>
                <div id="timeline-scrubber-container" class="h-10 rounded-xl bg-slate-900 border border-slate-800 relative cursor-pointer overflow-hidden"></div>
              </div>
            </div>

            <!-- Export Hub & Telemetry Breakdown -->
            <div class="flex flex-col gap-3">
              <!-- Export Action Buttons -->
              <div class="glass-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col gap-2.5">
                <span class="text-xs font-mono font-bold uppercase text-cyan-400 mb-1">EXPORT DATA & VIDEO</span>
                
                <button id="export-annotated-btn" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg glow-cyan transition">
                  ${Icons.film}
                  <span>Export Annotated Video (Burned Telemetry)</span>
                </button>

                <button id="download-raw-video-btn" class="w-full py-2 px-3 rounded-xl glass-panel text-slate-300 hover:text-white font-mono text-xs flex items-center justify-center gap-2 transition">
                  ${Icons.download}
                  <span>Download Raw Video (.webm)</span>
                </button>

                <div class="grid grid-cols-2 gap-2">
                  <button id="export-json-btn" class="py-2 px-3 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition">
                    ${Icons.fileText}
                    <span>JSON Data</span>
                  </button>
                  <button id="export-csv-btn" class="py-2 px-3 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition">
                    ${Icons.fileText}
                    <span>CSV Tracking</span>
                  </button>
                </div>

                <div id="export-status-text" class="text-[11px] font-mono text-cyan-400 text-center min-h-[16px]"></div>
              </div>

              <!-- Telemetry Stats Panel -->
              <div class="glass-panel rounded-2xl p-4 border border-cyan-500/20 flex flex-col gap-3 flex-1 overflow-y-auto">
                <span class="text-xs font-mono font-bold uppercase text-cyan-400">TELEMETRY SUMMARY</span>
                <div id="post-telemetry-metrics" class="space-y-2 font-mono text-xs"></div>
                <div id="post-category-chips" class="flex flex-wrap gap-1.5 pt-1"></div>
              </div>
            </div>
          </div>

          <!-- Video AI Conversational Grounding Assistant -->
          <div class="glass-panel rounded-2xl sm:rounded-3xl border border-cyan-500/20 overflow-hidden shadow-2xl flex flex-col p-4 gap-3 bg-cyber-950/80">
            <div class="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 glow-cyan">
                  ${Icons.sparkles}
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white font-display">VIDEO AI CONVERSATIONAL INTELLIGENCE</h3>
                  <p class="text-[10px] font-mono text-slate-400">Ask questions about movements, object appearances, and temporal events.</p>
                </div>
              </div>
            </div>

            <!-- Quick Suggestions -->
            <div class="flex flex-wrap gap-1.5">
              <button class="video-prompt-chip text-[11px] font-mono px-2.5 py-1 rounded-lg glass-panel text-cyan-300 hover:border-cyan-400 transition">
                "Summarize object movements across the video."
              </button>
              <button class="video-prompt-chip text-[11px] font-mono px-2.5 py-1 rounded-lg glass-panel text-cyan-300 hover:border-cyan-400 transition">
                "Which object remained visible the longest?"
              </button>
              <button class="video-prompt-chip text-[11px] font-mono px-2.5 py-1 rounded-lg glass-panel text-cyan-300 hover:border-cyan-400 transition">
                "Did any object move quickly or cross the frame?"
              </button>
            </div>

            <!-- Chat Messages Log -->
            <div id="video-chat-messages" class="h-44 overflow-y-auto p-2 space-y-2.5 bg-cyber-900/40 rounded-xl border border-slate-800"></div>

            <!-- Chat Input Bar -->
            <div class="flex items-center gap-2">
              <input id="video-chat-input" type="text" placeholder="Ask AI anything about the recorded video..." class="flex-1 bg-cyber-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-400 outline-none" />
              <button id="video-chat-send-btn" class="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase flex items-center gap-1.5 shadow-lg glow-cyan transition">
                ${Icons.send}
                <span>Ask</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.videoEl = document.getElementById('live-camera-video') as HTMLVideoElement;
    this.canvasEl = document.getElementById('live-tracking-canvas') as HTMLCanvasElement;

    this.attachDomEvents();
  }

  private attachDomEvents() {
    // Camera switcher
    document.getElementById('camera-select-dropdown')?.addEventListener('change', e => {
      this.selectedDeviceId = (e.target as HTMLSelectElement).value;
      this.startCamera();
    });

    document.getElementById('switch-camera-facing-btn')?.addEventListener('click', () => this.switchFacingMode());

    // Recording Controls
    document.getElementById('video-start-btn')?.addEventListener('click', () => this.startRecording());
    document.getElementById('video-stop-btn')?.addEventListener('click', () => this.stopRecording());
    document.getElementById('video-pause-btn')?.addEventListener('click', () => {
      if (this.recordingState === 'recording') this.pauseRecording();
      else if (this.recordingState === 'paused') this.resumeRecording();
    });
    document.getElementById('video-restart-btn')?.addEventListener('click', () => this.restartRecording());

    // Detection mode pills
    document.querySelectorAll('.mode-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-mode') as DetectionMode;
        this.detectionMode = mode;
        document.querySelectorAll('.mode-pill').forEach(b => {
          b.className = 'mode-pill px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white glass-panel';
        });
        target.className = 'mode-pill px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition bg-cyan-500 text-black';
      });
    });

    // Post-recording actions
    document.getElementById('post-record-again-btn')?.addEventListener('click', () => this.resetToLiveCapture());
    document.getElementById('download-raw-video-btn')?.addEventListener('click', () => this.downloadRawVideo());
    document.getElementById('export-annotated-btn')?.addEventListener('click', () => this.exportAnnotatedVideo());
    document.getElementById('export-json-btn')?.addEventListener('click', () => this.downloadTelemetryJson());
    document.getElementById('export-csv-btn')?.addEventListener('click', () => this.downloadTrackingCsv());

    // Video Chat
    const chatInput = document.getElementById('video-chat-input') as HTMLInputElement;
    const sendBtn = document.getElementById('video-chat-send-btn');
    const submitChat = () => {
      if (chatInput && chatInput.value) {
        this.askVideoQuestion(chatInput.value);
        chatInput.value = '';
      }
    };
    sendBtn?.addEventListener('click', submitChat);
    chatInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitChat();
    });

    // Suggestion chips
    document.querySelectorAll('.video-prompt-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        const text = (e.currentTarget as HTMLElement).textContent?.replace(/"/g, '').trim();
        if (text) this.askVideoQuestion(text);
      });
    });
  }

  private updateControlsUi() {
    const startBtn = document.getElementById('video-start-btn');
    const pauseBtn = document.getElementById('video-pause-btn');
    const stopBtn = document.getElementById('video-stop-btn') as HTMLButtonElement;
    const restartBtn = document.getElementById('video-restart-btn');

    if (this.recordingState === 'recording') {
      startBtn?.classList.add('hidden');
      pauseBtn?.classList.remove('hidden');
      if (pauseBtn) pauseBtn.innerHTML = `${Icons.pause}<span>Pause</span>`;
      stopBtn?.classList.remove('hidden');
      restartBtn?.classList.remove('hidden');
    } else if (this.recordingState === 'paused') {
      if (pauseBtn) pauseBtn.innerHTML = `${Icons.play}<span>Resume</span>`;
    } else if (this.recordingState === 'idle' || this.recordingState === 'stopped') {
      startBtn?.classList.remove('hidden');
      pauseBtn?.classList.add('hidden');
      stopBtn?.classList.remove('hidden');
      restartBtn?.classList.add('hidden');
      if (stopBtn) stopBtn.disabled = true;
    }
  }

  private updateLiveTelemetryUi() {
    const metrics = this.tracker.getMetrics();
    const activeCountEl = document.getElementById('stat-active-count');
    const totalCountEl = document.getElementById('stat-total-count');
    const badgeEl = document.getElementById('sidebar-tracks-count');
    const latencyEl = document.getElementById('live-latency-val');

    if (activeCountEl) activeCountEl.textContent = String(metrics.activeCount);
    if (totalCountEl) totalCountEl.textContent = String(metrics.totalCount);
    if (badgeEl) badgeEl.textContent = `${metrics.activeCount} ACTIVE`;
    if (latencyEl) latencyEl.textContent = `~${this.lastInferenceLatencyMs}ms Latency`;

    const list = document.getElementById('live-active-tracks-list');
    if (!list) return;

    const activeTracks = this.tracker.getActiveTracks();
    if (activeTracks.length === 0) {
      list.innerHTML = `
        <div class="text-center py-12 text-slate-500 font-mono text-xs">
          Scanning camera feed. Objects will appear with tracking IDs and trajectories.
        </div>
      `;
      return;
    }

    list.innerHTML = activeTracks
      .map(
        t => `
        <div class="p-2.5 rounded-xl bg-cyber-900 border border-slate-800 hover:border-cyan-500/40 transition flex items-center justify-between font-mono text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${t.color}"></span>
            <span class="font-bold text-white">${t.tracking_id}</span>
            <span class="text-slate-300 font-medium">${t.label}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-cyan-400 font-bold">${(t.confidence * 100).toFixed(0)}%</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] uppercase bg-slate-800 text-slate-400">${t.category}</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  private renderAnalysisTelemetry() {
    if (!this.analysisResult) return;
    const durEl = document.getElementById('post-summary-duration');
    if (durEl) {
      durEl.textContent = `Recorded ${this.analysisResult.duration_seconds.toFixed(1)}s video stream tracking ${this.analysisResult.total_unique_tracks} unique entities.`;
    }

    const metricsEl = document.getElementById('post-telemetry-metrics');
    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="flex justify-between border-b border-slate-800 pb-1.5">
          <span class="text-slate-400">Recording Duration:</span>
          <span class="font-bold text-white">${this.analysisResult.duration_seconds.toFixed(1)}s</span>
        </div>
        <div class="flex justify-between border-b border-slate-800 pb-1.5">
          <span class="text-slate-400">Total Unique Objects:</span>
          <span class="font-bold text-cyan-400">${this.analysisResult.total_unique_tracks}</span>
        </div>
        <div class="flex justify-between border-b border-slate-800 pb-1.5">
          <span class="text-slate-400">Peak Simultaneous:</span>
          <span class="font-bold text-orange-400">${this.analysisResult.peak_simultaneous_objects}</span>
        </div>
        <div class="flex justify-between border-b border-slate-800 pb-1.5">
          <span class="text-slate-400">Detection Method:</span>
          <span class="font-bold text-slate-200">Open-Vocabulary Vision AI</span>
        </div>
      `;
    }

    const chipsEl = document.getElementById('post-category-chips');
    if (chipsEl) {
      chipsEl.innerHTML = Object.entries(this.analysisResult.category_distribution)
        .map(
          ([cat, count]) => `
          <span class="px-2 py-1 rounded-lg text-[10px] font-mono uppercase bg-slate-900 border border-slate-700 text-slate-200 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${getCategoryColor(cat)}"></span>
            <span>${cat}: ${count}</span>
          </span>
        `
        )
        .join('');
    }
  }

  private renderTimelineScrubber() {
    if (!this.analysisResult) return;
    const container = document.getElementById('timeline-scrubber-container');
    if (!container) return;

    const duration = this.analysisResult.duration_seconds;
    container.innerHTML = this.analysisResult.tracks
      .map(t => {
        const startPct = (t.first_seen_time / duration) * 100;
        const widthPct = Math.max(3, ((t.last_seen_time - t.first_seen_time) / duration) * 100);
        return `
        <div class="timeline-bar absolute h-2 rounded-full cursor-pointer transition hover:h-4 z-10" 
             style="left: ${startPct}%; width: ${widthPct}%; top: ${Math.random() * 20 + 4}px; background-color: ${t.color}" 
             data-time="${t.first_seen_time}" 
             title="${t.tracking_id} (${t.label}): ${t.first_seen_time.toFixed(1)}s - ${t.last_seen_time.toFixed(1)}s">
        </div>
      `;
      })
      .join('');

    container.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const bar = target.closest('.timeline-bar') as HTMLElement;
      if (bar && this.postRecordVideoEl) {
        const time = parseFloat(bar.getAttribute('data-time') || '0');
        this.postRecordVideoEl.currentTime = time;
        this.postRecordVideoEl.play();
      } else if (this.postRecordVideoEl) {
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        this.postRecordVideoEl.currentTime = pct * (this.postRecordVideoEl.duration || duration);
      }
    });
  }

  private renderPostTrackList() {
    // Handled in metrics and timeline
  }
}
