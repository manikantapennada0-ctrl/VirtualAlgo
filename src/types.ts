export interface NormalizedBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface PixelBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  object_id: string;
  label: string;
  category: string;
  confidence: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000
  normalized_box: NormalizedBox;
  pixel_box?: PixelBox;
  description: string;
  visible: boolean;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type DetectionMode = 'all' | 'people' | 'vehicles' | 'traffic' | 'scene' | 'custom';
export type DetectionSensitivity = 'balanced' | 'recall' | 'precision';

export interface DetectionSession {
  id: string;
  timestamp: string;
  imageName: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  sceneSummary: string;
  totalObjects: number;
  processingTimeMs: number;
  mode: DetectionMode;
  sensitivity: DetectionSensitivity;
  detections: DetectedObject[];
  chatHistory: ChatMessage[];
}

export interface SampleImage {
  id: string;
  title: string;
  category: string;
  description: string;
  url: string;
}

export interface TrajectoryPoint {
  x: number; // 0..1000
  y: number; // 0..1000
  timestamp: number; // seconds from recording start
}

export interface TrackedObject {
  tracking_id: string; // e.g. "TRK_01" or "PERSON #01"
  numeric_id: number;
  label: string;
  category: string;
  confidence: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000
  target_box_2d: [number, number, number, number]; // for smooth interpolation
  velocity: { vx: number; vy: number }; // normalized units/sec
  trajectory: TrajectoryPoint[];
  first_seen_time: number;
  last_seen_time: number;
  total_detections: number;
  is_active: boolean;
  disappeared_count: number;
  color: string;
}

export type VideoRecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface VideoTimelineEvent {
  timestamp: number;
  track_id: string;
  label: string;
  category: string;
  type: 'entered' | 'left' | 'moved_fast';
  description: string;
}

export interface VideoAnalysisResult {
  duration_seconds: number;
  total_unique_tracks: number;
  peak_simultaneous_objects: number;
  tracks: TrackedObject[];
  timeline_events: VideoTimelineEvent[];
  category_distribution: Record<string, number>;
  motion_summary: string;
}
