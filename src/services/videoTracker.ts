import { DetectedObject, TrackedObject, TrajectoryPoint } from '../types';
import { getCategoryColor } from '../constants';

export function calculateIoU(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number]
): number {
  const [yminA, xminA, ymaxA, xmaxA] = boxA;
  const [yminB, xminB, ymaxB, xmaxB] = boxB;

  const ymin = Math.max(yminA, yminB);
  const xmin = Math.max(xminA, xminB);
  const ymax = Math.min(ymaxA, ymaxB);
  const xmax = Math.min(xmaxA, xmaxB);

  const interWidth = Math.max(0, xmax - xmin);
  const interHeight = Math.max(0, ymax - ymin);
  const interArea = interWidth * interHeight;

  const areaA = Math.max(0, xmaxA - xminA) * Math.max(0, ymaxA - yminA);
  const areaB = Math.max(0, xmaxB - xminB) * Math.max(0, ymaxB - yminB);

  const unionArea = areaA + areaB - interArea;
  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

export class VideoTracker {
  private tracks: Map<string, TrackedObject> = new Map();
  private nextNumericId: number = 1;
  private peakSimultaneous: number = 0;
  private readonly maxDisappeared: number = 4; // inference cycles before considering lost
  private readonly iouThreshold: number = 0.22; // minimum overlap to match tracks

  public reset() {
    this.tracks.clear();
    this.nextNumericId = 1;
    this.peakSimultaneous = 0;
  }

  /**
   * Called every time an AI detection frame completes.
   * Matches new detections to active or recent tracks using IoU & label affinity.
   */
  public update(detections: DetectedObject[], currentTimestampSec: number): TrackedObject[] {
    const activeTracks = Array.from(this.tracks.values()).filter(t => t.is_active || t.disappeared_count < this.maxDisappeared);
    const matchedTrackIds = new Set<string>();
    const matchedDetectionIndices = new Set<number>();

    // Compute cost/IoU matrix
    interface MatchCandidate {
      trackId: string;
      detectionIndex: number;
      iou: number;
      score: number;
    }

    const candidates: MatchCandidate[] = [];

    for (const track of activeTracks) {
      for (let i = 0; i < detections.length; i++) {
        const det = detections[i];
        const iou = calculateIoU(track.box_2d, det.box_2d);
        const labelMatch = track.label.toLowerCase() === det.label.toLowerCase();
        const categoryMatch = track.category.toLowerCase() === det.category.toLowerCase();

        // Bonus score if labels or categories match
        let score = iou;
        if (labelMatch) score += 0.3;
        else if (categoryMatch) score += 0.15;

        if (iou >= this.iouThreshold || (score >= 0.35 && iou >= 0.12)) {
          candidates.push({
            trackId: track.tracking_id,
            detectionIndex: i,
            iou,
            score,
          });
        }
      }
    }

    // Sort candidates by highest matching score (greedy matching)
    candidates.sort((a, b) => b.score - a.score);

    for (const cand of candidates) {
      if (matchedTrackIds.has(cand.trackId) || matchedDetectionIndices.has(cand.detectionIndex)) {
        continue;
      }

      const track = this.tracks.get(cand.trackId);
      const det = detections[cand.detectionIndex];
      if (!track || !det) continue;

      matchedTrackIds.add(cand.trackId);
      matchedDetectionIndices.add(cand.detectionIndex);

      // Calculate motion velocity (dx, dy of center)
      const prevCenterX = (track.box_2d[1] + track.box_2d[3]) / 2;
      const prevCenterY = (track.box_2d[0] + track.box_2d[2]) / 2;
      const newCenterX = (det.box_2d[1] + det.box_2d[3]) / 2;
      const newCenterY = (det.box_2d[0] + det.box_2d[2]) / 2;

      const dt = Math.max(0.1, currentTimestampSec - track.last_seen_time);
      const vx = (newCenterX - prevCenterX) / dt;
      const vy = (newCenterY - prevCenterY) / dt;

      // Update track properties
      track.target_box_2d = [...det.box_2d];
      track.velocity = { vx: vx * 0.7 + track.velocity.vx * 0.3, vy: vy * 0.7 + track.velocity.vy * 0.3 };
      track.confidence = det.confidence;
      track.last_seen_time = currentTimestampSec;
      track.total_detections += 1;
      track.disappeared_count = 0;
      track.is_active = true;

      // Add to trajectory history
      track.trajectory.push({
        x: newCenterX,
        y: newCenterY,
        timestamp: currentTimestampSec,
      });

      // Keep trajectory bounded (e.g. max 50 points)
      if (track.trajectory.length > 50) {
        track.trajectory.shift();
      }
    }

    // Unmatched tracks increase disappearance counter
    for (const track of activeTracks) {
      if (!matchedTrackIds.has(track.tracking_id)) {
        track.disappeared_count += 1;
        if (track.disappeared_count >= this.maxDisappeared) {
          track.is_active = false;
        } else {
          // Extrapolate position slightly based on velocity
          const dt = 0.4;
          const [ymin, xmin, ymax, xmax] = track.box_2d;
          const dx = Math.max(-50, Math.min(50, track.velocity.vx * dt));
          const dy = Math.max(-50, Math.min(50, track.velocity.vy * dt));
          track.target_box_2d = [
            Math.max(0, Math.min(1000, ymin + dy)),
            Math.max(0, Math.min(1000, xmin + dx)),
            Math.max(0, Math.min(1000, ymax + dy)),
            Math.max(0, Math.min(1000, xmax + dx)),
          ];
        }
      }
    }

    // Unmatched detections create brand new tracks
    for (let i = 0; i < detections.length; i++) {
      if (matchedDetectionIndices.has(i)) continue;

      const det = detections[i];
      const numericId = this.nextNumericId++;
      const paddedId = String(numericId).padStart(2, '0');
      const trackId = `TRK_${paddedId}`;

      const centerX = (det.box_2d[1] + det.box_2d[3]) / 2;
      const centerY = (det.box_2d[0] + det.box_2d[2]) / 2;

      const newTrack: TrackedObject = {
        tracking_id: trackId,
        numeric_id: numericId,
        label: det.label,
        category: det.category,
        confidence: det.confidence,
        box_2d: [...det.box_2d],
        target_box_2d: [...det.box_2d],
        velocity: { vx: 0, vy: 0 },
        trajectory: [{ x: centerX, y: centerY, timestamp: currentTimestampSec }],
        first_seen_time: currentTimestampSec,
        last_seen_time: currentTimestampSec,
        total_detections: 1,
        is_active: true,
        disappeared_count: 0,
        color: det.color || getCategoryColor(det.category),
      };

      this.tracks.set(trackId, newTrack);
    }

    // Update peak simultaneous count
    const currentlyActiveCount = Array.from(this.tracks.values()).filter(t => t.is_active).length;
    if (currentlyActiveCount > this.peakSimultaneous) {
      this.peakSimultaneous = currentlyActiveCount;
    }

    return this.getActiveTracks();
  }

  /**
   * Called every animation frame (60 FPS) to smoothly interpolate box positions
   */
  public stepFrame(lerpFactor: number = 0.25) {
    for (const track of this.tracks.values()) {
      if (!track.is_active && track.disappeared_count >= this.maxDisappeared) continue;

      for (let i = 0; i < 4; i++) {
        const current = track.box_2d[i];
        const target = track.target_box_2d[i];
        track.box_2d[i] = current + (target - current) * lerpFactor;
      }
    }
  }

  public getActiveTracks(): TrackedObject[] {
    return Array.from(this.tracks.values()).filter(t => t.is_active);
  }

  public getAllTracks(): TrackedObject[] {
    return Array.from(this.tracks.values()).sort((a, b) => a.numeric_id - b.numeric_id);
  }

  public getMetrics() {
    const active = this.getActiveTracks().length;
    const total = this.tracks.size;
    return {
      activeCount: active,
      totalCount: total,
      peakSimultaneous: this.peakSimultaneous,
    };
  }
}
