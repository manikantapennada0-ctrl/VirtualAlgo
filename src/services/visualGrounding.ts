import { GoogleGenAI } from '@google/genai';
import { DetectedObject, DetectionMode, GroundingResult } from '../types';
import { renderAnnotatedImage } from './imageAnnotator';
import { detectObjectsDynamically } from './objectDetector';

export async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { valid: false, message: 'API key cannot be empty.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Respond with OK',
    });

    if (response && response.text) {
      return { valid: true, message: 'API key is valid and connected to Gemini!' };
    }
    return { valid: false, message: 'No response received from Gemini.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, message: `Validation failed: ${msg}` };
  }
}

export async function analyzeImage(params: {
  image: File | Blob | string;
  question: string;
  mode: DetectionMode;
  apiKey?: string;
  filename?: string;
}): Promise<GroundingResult> {
  const { image, question, mode, apiKey } = params;

  // Extract filename identifier if available
  let filename = params.filename || '';
  if (!filename && typeof image === 'string') {
    const cleanUrl = image.split('?')[0];
    const slashIdx = cleanUrl.lastIndexOf('/');
    if (slashIdx !== -1) {
      filename = cleanUrl.substring(slashIdx + 1);
    }
  } else if (!filename && typeof image === 'object' && 'name' in image) {
    filename = (image as any).name || '';
  }

  const activeKey =
    (apiKey && apiKey.trim()) ||
    localStorage.getItem('gemini_api_key') ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    '';

  // Load image element for client-side pixel inspection & Coco-SSD
  const imgElement = await loadImageElement(image);

  let rawResult: {
    answer: string;
    relevant_visual_info: string;
    objects: Array<{
      label: string;
      box_norm?: [number, number, number, number];
      box_2d?: [number, number, number, number];
      is_relevant_to_question?: boolean;
      confidence?: number;
      description?: string;
      color_hex?: string;
    }>;
    source: string;
  } | null = null;

  // 1. Try server-side /api/analyze proxy first if activeKey is present
  if (activeKey.trim()) {
    try {
      const base64Data = await convertSourceToBase64(image);
      const serverRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64Data}`,
          question,
          mode,
          api_key: activeKey,
        }),
      });

      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData && !serverData.fallback_to_client && serverData.objects && serverData.objects.length > 0) {
          rawResult = {
            answer: serverData.answer,
            relevant_visual_info: serverData.relevant_visual_info,
            objects: serverData.objects,
            source: serverData.source || 'Gemini Multimodal Vision + OpenCV Grounding',
          };
        }
      }
    } catch (serverErr) {
      console.warn('Server-side /api/analyze call failed:', serverErr);
    }

    // 2. Try client-side Gemini Vision if browser key is present and server didn't respond
    if (!rawResult) {
      try {
        rawResult = await queryGeminiVision(image, question, mode, activeKey.trim());
      } catch (err) {
        console.warn('Gemini Vision client query failed:', err);
      }
    }
  }

  // 3. Dynamic Computer Vision & Deep Learning Object Detection Engine
  // Runs whenever no Gemini key is provided, or when Gemini API is unavailable
  if (!rawResult || !rawResult.objects || rawResult.objects.length === 0) {
    const dynamicDetection = await detectObjectsDynamically(
      imgElement,
      question,
      mode,
      filename
    );

    rawResult = {
      answer: dynamicDetection.answer,
      relevant_visual_info: dynamicDetection.relevantVisualInfo,
      objects: dynamicDetection.objects.map((obj) => ({
        label: obj.label,
        box_norm: obj.box_norm,
        confidence: obj.confidence,
        description: obj.description,
        is_relevant_to_question: obj.is_relevant,
        color_hex: obj.color_hex,
      })),
      source: dynamicDetection.source,
    };
  }

  // Normalize detected objects
  const detectedObjects: DetectedObject[] = rawResult.objects.map((obj: any, idx: number) => {
    const rawBox = obj.box_norm || obj.box_2d || obj.box;
    const boxNorm = normalizeBox(rawBox);
    return {
      id: idx + 1,
      label: obj.label || `Entity ${idx + 1}`,
      confidence: typeof obj.confidence === 'number' ? Math.round(obj.confidence * 100) / 100 : 0.95,
      is_relevant: obj.is_relevant !== false && obj.is_relevant_to_question !== false,
      description: obj.description || `Identified ${obj.label} in scene.`,
      box_norm: boxNorm,
      color_hex: obj.color_hex,
    };
  });

  // Render annotated OpenCV-style image with corner brackets and badges
  const { annotatedDataUrl, width, height } = await renderAnnotatedImage(
    image,
    detectedObjects,
    mode
  );

  return {
    question,
    mode,
    answer: rawResult.answer || 'Visual grounding analysis complete.',
    relevant_visual_info:
      rawResult.relevant_visual_info ||
      'Focused attention on prominent foreground entities while filtering background noise.',
    detected_objects: detectedObjects,
    total_detected: detectedObjects.length,
    annotated_image: annotatedDataUrl,
    image_dims: { width, height },
    source: rawResult.source,
  };
}

async function queryGeminiVision(
  imageSource: File | Blob | string,
  question: string,
  mode: DetectionMode,
  apiKey: string
) {
  const ai = new GoogleGenAI({ apiKey });
  const maxObjects = mode === 'task_focused' ? 3 : 8;

  const base64Data = await convertSourceToBase64(imageSource);

  const prompt = `You are an expert computer vision and object grounding model.
Analyze this image and answer the user inquiry: "${question}".
Mode: "${mode}".

CRITICAL INSTRUCTIONS:
1. Detect actual objects and entities (e.g. Person, Face, White T-Shirt, Bicycle, Car, Dog, Laptop, Cell Phone, etc.). NEVER return generic placeholders like "Primary Visual Focus".
2. Return bounding boxes in normalized coordinates [ymin, xmin, ymax, xmax] between 0 and 1000.
3. Answer the question directly and concisely.

Return JSON only:
{
  "answer": "Clear, direct answer to the user question",
  "relevant_visual_info": "Explain which foreground objects were prioritized vs background filtered",
  "objects": [
    {
      "label": "Specific entity name",
      "box_2d": [ymin, xmin, ymax, xmax],
      "is_relevant_to_question": true,
      "confidence": 0.95,
      "description": "Short visual description"
    }
  ]
}`;

  let responseText = '';
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        { text: prompt },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });
    responseText = response.text || '';
  } catch (firstErr) {
    console.warn('gemini-flash-latest failed, trying gemini-3.8-flash:', firstErr);
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        { text: prompt },
      ],
      config: {
        temperature: 0.1,
      },
    });
    responseText = fallbackResponse.text || '';
  }

  const parsed = parseJsonFromText(responseText);

  return {
    answer: parsed.answer || 'Analysis complete.',
    relevant_visual_info: parsed.relevant_visual_info || '',
    objects: (parsed.objects || []).slice(0, maxObjects),
    source: 'Gemini Multimodal Vision + OpenCV Grounding',
  };
}

function parseJsonFromText(text: string): Record<string, any> {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function normalizeBox(rawBox: any): [number, number, number, number] {
  if (!Array.isArray(rawBox) || rawBox.length < 4) {
    return [200, 200, 800, 800];
  }

  let [y1, x1, y2, x2] = rawBox.map((v) => Number(v) || 0);

  if (Math.max(y1, x1, y2, x2) <= 1.5) {
    y1 *= 1000;
    x1 *= 1000;
    y2 *= 1000;
    x2 *= 1000;
  }

  if (y1 > y2) [y1, y2] = [y2, y1];
  if (x1 > x2) [x1, x2] = [x2, x1];

  y1 = Math.max(0, Math.min(1000, Math.round(y1)));
  x1 = Math.max(0, Math.min(1000, Math.round(x1)));
  y2 = Math.max(0, Math.min(1000, Math.round(y2)));
  x2 = Math.max(0, Math.min(1000, Math.round(x2)));

  if (y2 - y1 < 20) y2 = Math.min(1000, y1 + 50);
  if (x2 - x1 < 20) x2 = Math.min(1000, x1 + 50);

  return [y1, x1, y2, x2];
}

function loadImageElement(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

async function convertSourceToBase64(source: File | Blob | string): Promise<string> {
  if (typeof source === 'string') {
    if (source.includes('base64,')) {
      return source.split('base64,')[1];
    }
    // Remote or local URL
    const res = await fetch(source);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.includes('base64,') ? result.split('base64,')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.includes('base64,') ? result.split('base64,')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(source);
  });
}
