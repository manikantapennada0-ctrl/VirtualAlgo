export type DetectionMode = 'task_focused' | 'all_objects' | 'hybrid';

export interface BoundingBoxNorm {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface DetectedObject {
  id: number;
  label: string;
  confidence: number;
  is_relevant: boolean;
  description: string;
  box_pixels?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  box_norm: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  color_hex?: string;
}

export interface GroundingResult {
  question: string;
  mode: DetectionMode;
  answer: string;
  relevant_visual_info: string;
  detected_objects: DetectedObject[];
  total_detected: number;
  annotated_image: string; // Data URL or URL
  original_image?: string;
  image_dims: {
    width: number;
    height: number;
  };
  source: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  result?: GroundingResult;
  error?: string;
  isLoading?: boolean;
  timestamp: number;
}

export interface SamplePreset {
  id: string;
  filename: string;
  title: string;
  question: string;
  image_url: string;
  icon: string;
  description: string;
}
