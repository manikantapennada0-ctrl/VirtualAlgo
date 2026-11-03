import { DetectedObject, DetectionMode, DetectionSensitivity, ChatMessage } from '../types';

export interface DetectResponse {
  success: boolean;
  processing_time_ms: number;
  scene_summary: string;
  total_objects: number;
  detections: DetectedObject[];
  model_used?: string;
  isQuotaFallback?: boolean;
  quota_notice?: string;
  error?: string;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  isQuotaFallback?: boolean;
  error?: string;
}

export class ApiService {
  static async checkHealth(): Promise<{ status: string; models: string[]; hasApiKey: boolean }> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      const text = await res.text();
      return JSON.parse(text);
    } catch {
      return { status: 'offline', models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'], hasApiKey: false };
    }
  }

  static async detectObjects(
    imageBase64: string,
    mode: DetectionMode = 'all',
    sensitivity: DetectionSensitivity = 'balanced',
    customPrompt?: string
  ): Promise<DetectResponse> {
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mode,
          sensitivity,
          customPrompt,
        }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned invalid response format.');
      }

      if (!res.ok || !data.success) {
        const rawErr = data.error || `HTTP ${res.status}`;
        if (rawErr.includes('429') || rawErr.includes('quota') || rawErr.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Gemini Free Tier daily request limit reached (20/day). Switch to a billing-enabled key in Settings > Secrets for unlimited vision.');
        }
        throw new Error(rawErr);
      }

      return data;
    } catch (err: any) {
      if (err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        throw new Error('Gemini Free Tier daily request limit reached (20/day). Switch to a billing-enabled key in Settings > Secrets.');
      }
      throw err;
    }
  }

  static async askVisualAssistant(
    question: string,
    imageBase64?: string,
    history: ChatMessage[] = [],
    detections: DetectedObject[] = [],
    sceneSummary: string = ''
  ): Promise<ChatResponse> {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          imageBase64,
          history: history.map(h => ({ role: h.role, content: h.content })),
          detections: detections.map(d => ({
            object_id: d.object_id,
            label: d.label,
            category: d.category,
            confidence: d.confidence,
            box_2d: d.box_2d,
            description: d.description,
          })),
          sceneSummary,
        }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned invalid response format.');
      }

      if (!res.ok || !data.success) {
        const rawErr = data.error || `HTTP ${res.status}`;
        if (rawErr.includes('429') || rawErr.includes('quota') || rawErr.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Gemini Free Tier daily request limit reached. Attach a billing-enabled key in Settings > Secrets.');
        }
        throw new Error(rawErr);
      }

      return data;
    } catch (err: any) {
      if (err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        throw new Error('Gemini Free Tier daily request limit reached. Attach a billing-enabled key in Settings > Secrets.');
      }
      throw err;
    }
  }
}
