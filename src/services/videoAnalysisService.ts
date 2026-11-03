import { TrackedObject, VideoAnalysisResult, VideoTimelineEvent } from '../types';

export class VideoAnalysisService {
  /**
   * Compiles structured analysis and event log from session tracks
   */
  public static generateAnalysis(tracks: TrackedObject[], durationSeconds: number): VideoAnalysisResult {
    const categoryDistribution: Record<string, number> = {};
    const timelineEvents: VideoTimelineEvent[] = [];

    let peakSimultaneous = 0;
    const timeSlices: number[] = new Array(Math.ceil(durationSeconds) + 1).fill(0);

    for (const track of tracks) {
      // Category count
      const cat = track.category || 'General';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;

      // Mark slice presence
      const startSec = Math.floor(track.first_seen_time);
      const endSec = Math.min(timeSlices.length - 1, Math.ceil(track.last_seen_time));
      for (let s = startSec; s <= endSec; s++) {
        timeSlices[s] = (timeSlices[s] || 0) + 1;
        if (timeSlices[s] > peakSimultaneous) {
          peakSimultaneous = timeSlices[s];
        }
      }

      // Add entered event
      timelineEvents.push({
        timestamp: track.first_seen_time,
        track_id: track.tracking_id,
        label: track.label,
        category: track.category,
        type: 'entered',
        description: `${track.label.toUpperCase()} (${track.tracking_id}) entered camera field of view at ${track.first_seen_time.toFixed(1)}s`,
      });

      // Add left event if disappeared before video end
      if (track.last_seen_time < durationSeconds - 1.5) {
        timelineEvents.push({
          timestamp: track.last_seen_time,
          track_id: track.tracking_id,
          label: track.label,
          category: track.category,
          type: 'left',
          description: `${track.label.toUpperCase()} (${track.tracking_id}) exited detection view at ${track.last_seen_time.toFixed(1)}s`,
        });
      }

      // Check for significant motion
      if (track.trajectory.length >= 4) {
        const first = track.trajectory[0];
        const last = track.trajectory[track.trajectory.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const totalDistance = Math.hypot(dx, dy);

        if (totalDistance > 180) {
          const midTime = (track.first_seen_time + track.last_seen_time) / 2;
          timelineEvents.push({
            timestamp: midTime,
            track_id: track.tracking_id,
            label: track.label,
            category: track.category,
            type: 'moved_fast',
            description: `${track.label.toUpperCase()} (${track.tracking_id}) traversed across ${Math.round(totalDistance / 10)}% of the camera frame`,
          });
        }
      }
    }

    // Sort timeline events chronologically
    timelineEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Build human-readable summary
    const catKeys = Object.keys(categoryDistribution);
    const catSummary = catKeys.map(k => `${categoryDistribution[k]} ${k.toLowerCase()}`).join(', ');
    const motionSummary = `Recorded ${durationSeconds.toFixed(1)}s video stream tracking ${tracks.length} unique objects across ${catKeys.length} categories (${catSummary || 'None'}). Peak simultaneous object load reached ${peakSimultaneous} concurrent entities.`;

    return {
      duration_seconds: durationSeconds,
      total_unique_tracks: tracks.length,
      peak_simultaneous_objects: peakSimultaneous,
      tracks,
      timeline_events: timelineEvents,
      category_distribution: categoryDistribution,
      motion_summary: motionSummary,
    };
  }

  /**
   * Generates clean CSV tracking data for data analysis
   */
  public static exportTrackingCsv(analysis: VideoAnalysisResult): string {
    const headers = [
      'Track_ID',
      'Label',
      'Category',
      'Confidence',
      'First_Seen_Sec',
      'Last_Seen_Sec',
      'Duration_Sec',
      'Total_Detections',
      'Initial_Top_0_1000',
      'Initial_Left_0_1000',
      'Initial_Bottom_0_1000',
      'Initial_Right_0_1000',
      'Trajectory_Points_Count',
    ];

    const rows = analysis.tracks.map(t => {
      const duration = (t.last_seen_time - t.first_seen_time).toFixed(2);
      return [
        t.tracking_id,
        `"${t.label.replace(/"/g, '""')}"`,
        `"${t.category.replace(/"/g, '""')}"`,
        (t.confidence * 100).toFixed(1) + '%',
        t.first_seen_time.toFixed(2),
        t.last_seen_time.toFixed(2),
        duration,
        t.total_detections,
        t.box_2d[0],
        t.box_2d[1],
        t.box_2d[2],
        t.box_2d[3],
        t.trajectory.length,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generates formatted JSON telemetry
   */
  public static exportTelemetryJson(analysis: VideoAnalysisResult): string {
    return JSON.stringify(
      {
        session_type: 'VISUAL_ALGO_LIVE_VIDEO_TRACKING',
        generated_at: new Date().toISOString(),
        video_metadata: {
          duration_seconds: analysis.duration_seconds,
          total_unique_tracks: analysis.total_unique_tracks,
          peak_simultaneous_objects: analysis.peak_simultaneous_objects,
          categories: analysis.category_distribution,
          motion_summary: analysis.motion_summary,
        },
        timeline_events: analysis.timeline_events,
        tracked_objects: analysis.tracks.map(t => ({
          tracking_id: t.tracking_id,
          label: t.label,
          category: t.category,
          confidence: t.confidence,
          first_seen_time: t.first_seen_time,
          last_seen_time: t.last_seen_time,
          box_2d: t.box_2d,
          trajectory: t.trajectory,
        })),
      },
      null,
      2
    );
  }

  /**
   * Renders the recorded video through an offscreen canvas, burning bounding boxes,
   * labels, tracking IDs, telemetry HUD, and watermark into a new annotated .webm video!
   */
  public static async renderAnnotatedVideo(
    rawVideoBlob: Blob,
    tracks: TrackedObject[],
    durationSeconds: number,
    onProgress?: (progressPct: number) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(rawVideoBlob);

      video.onloadedmetadata = () => {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(video.src);
          return reject(new Error('Canvas 2D context unavailable'));
        }

        const stream = canvas.captureStream(30);
        let recorder: MediaRecorder;
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';

        try {
          recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
        } catch {
          recorder = new MediaRecorder(stream);
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          const finalBlob = new Blob(chunks, { type: mimeType });
          resolve(finalBlob);
        };

        recorder.onerror = e => {
          URL.revokeObjectURL(video.src);
          reject(e);
        };

        recorder.start(100);

        // Precompute track positions over time
        // For each track, we can sample position at video.currentTime
        function getTrackBoxAtTime(track: TrackedObject, time: number): [number, number, number, number] | null {
          if (time < track.first_seen_time - 0.5 || time > track.last_seen_time + 1.2) {
            return null; // not visible
          }

          // If trajectory exists, find closest points
          if (track.trajectory.length === 0) return track.box_2d;
          if (track.trajectory.length === 1) return track.box_2d;

          // Find surrounding points
          let pPrev = track.trajectory[0];
          let pNext = track.trajectory[track.trajectory.length - 1];

          for (let i = 0; i < track.trajectory.length - 1; i++) {
            if (time >= track.trajectory[i].timestamp && time <= track.trajectory[i + 1].timestamp) {
              pPrev = track.trajectory[i];
              pNext = track.trajectory[i + 1];
              break;
            }
          }

          const span = Math.max(0.001, pNext.timestamp - pPrev.timestamp);
          const ratio = Math.max(0, Math.min(1, (time - pPrev.timestamp) / span));

          const curCenterX = pPrev.x + (pNext.x - pPrev.x) * ratio;
          const curCenterY = pPrev.y + (pNext.y - pPrev.y) * ratio;

          const w = track.box_2d[3] - track.box_2d[1];
          const h = track.box_2d[2] - track.box_2d[0];

          return [
            Math.max(0, curCenterY - h / 2),
            Math.max(0, curCenterX - w / 2),
            Math.min(1000, curCenterY + h / 2),
            Math.min(1000, curCenterX + w / 2),
          ];
        }

        let animationFrameId: number;

        const drawFrame = () => {
          if (video.ended || video.currentTime >= video.duration - 0.05) {
            cancelAnimationFrame(animationFrameId);
            setTimeout(() => {
              if (recorder.state === 'recording') recorder.stop();
            }, 300);
            return;
          }

          const currentTime = video.currentTime;
          const progress = Math.min(100, Math.round((currentTime / video.duration) * 100));
          if (onProgress) onProgress(progress);

          // 1. Draw raw video frame
          ctx.drawImage(video, 0, 0, width, height);

          // 2. Draw tracks active at currentTime
          let activeTracksCount = 0;

          tracks.forEach(track => {
            const box = getTrackBoxAtTime(track, currentTime);
            if (!box) return;

            activeTracksCount++;

            const [ymin, xmin, ymax, xmax] = box;
            const x = (xmin / 1000) * width;
            const y = (ymin / 1000) * height;
            const w = ((xmax - xmin) / 1000) * width;
            const h = ((ymax - ymin) / 1000) * height;

            const color = track.color || '#00f2fe';

            // Box shadow / glow
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, width / 400);
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.strokeRect(x, y, w, h);

            // Tech corner brackets
            const bracketLen = Math.min(w, h) * 0.25;
            ctx.lineWidth = Math.max(3, width / 300);
            ctx.beginPath();
            // Top-left
            ctx.moveTo(x, y + bracketLen);
            ctx.lineTo(x, y);
            ctx.lineTo(x + bracketLen, y);
            // Top-right
            ctx.moveTo(x + w - bracketLen, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + bracketLen);
            // Bottom-left
            ctx.moveTo(x, y + h - bracketLen);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + bracketLen, y + h);
            // Bottom-right
            ctx.moveTo(x + w - bracketLen, y + h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w, y + h - bracketLen);
            ctx.stroke();

            // Label pill
            const fontSize = Math.max(12, Math.round(width / 75));
            ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
            const labelText = `[${track.tracking_id}] ${track.label.toUpperCase()} • ${(track.confidence * 100).toFixed(0)}%`;
            const textMetrics = ctx.measureText(labelText);
            const pillW = textMetrics.width + 16;
            const pillH = fontSize + 10;
            const pillY = Math.max(0, y - pillH - 2);

            ctx.fillStyle = '#050b14e6';
            ctx.fillRect(x, pillY, pillW, pillH);

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, pillY, pillW, pillH);

            ctx.fillStyle = color;
            ctx.fillText(labelText, x + 8, pillY + fontSize);

            ctx.restore();
          });

          // 3. Top Cyber Telemetry Bar
          ctx.save();
          const barH = Math.max(36, height * 0.06);
          ctx.fillStyle = 'rgba(5, 11, 20, 0.88)';
          ctx.fillRect(0, 0, width, barH);
          ctx.strokeStyle = '#00f2fe44';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, barH);
          ctx.lineTo(width, barH);
          ctx.stroke();

          // Rec indicator + timestamp
          const hudFont = Math.max(12, Math.round(width / 90));
          ctx.font = `bold ${hudFont}px "JetBrains Mono", monospace`;

          // Red Rec Dot
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(22, barH / 2, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          const curTimeStr = formatSeconds(currentTime);
          const durTimeStr = formatSeconds(video.duration || durationSeconds);
          ctx.fillText(`PLAYBACK  ${curTimeStr} / ${durTimeStr}`, 38, barH / 2 + hudFont / 3);

          // Center: Objects count
          const centerText = `TRACKED OBJECTS IN FRAME: ${activeTracksCount}`;
          const centerMetrics = ctx.measureText(centerText);
          ctx.fillStyle = '#00f2fe';
          ctx.fillText(centerText, (width - centerMetrics.width) / 2, barH / 2 + hudFont / 3);

          // Right: Branding
          ctx.fillStyle = '#ff6a00';
          const rightText = `VISUAL ALGO v2.0 • ANNOTATED`;
          const rightMetrics = ctx.measureText(rightText);
          ctx.fillText(rightText, width - rightMetrics.width - 20, barH / 2 + hudFont / 3);

          ctx.restore();

          // 4. Bottom Right Watermark
          ctx.save();
          ctx.font = `bold ${Math.max(10, width / 120)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillText('AI-POWERED OBJECT TRACKING • VISUAL ALGO', 16, height - 16);
          ctx.restore();

          animationFrameId = requestAnimationFrame(drawFrame);
        };

        video.play().then(() => {
          drawFrame();
        }).catch(err => {
          URL.revokeObjectURL(video.src);
          reject(err);
        });
      };

      video.onerror = e => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video for annotation rendering'));
      };
    });
  }
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}
