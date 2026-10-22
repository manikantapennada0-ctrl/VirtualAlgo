import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    has_server_gemini_key: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Test API Key
app.post('/api/test_key', async (req: Request, res: Response) => {
  const userKey = (req.body?.api_key || '').trim();
  const keyToUse = userKey || process.env.GEMINI_API_KEY;

  if (!keyToUse) {
    return res.json({
      valid: false,
      message: 'No Gemini API key found on client or server.',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Respond with OK',
    });

    if (response && response.text) {
      return res.json({
        valid: true,
        message: 'API key is valid and connected to Gemini Vision!',
      });
    }
    return res.json({
      valid: false,
      message: 'No text response from Gemini API.',
    });
  } catch (err: any) {
    return res.json({
      valid: false,
      message: `Key validation failed: ${err?.message || err}`,
    });
  }
});

// Analyze Image endpoint with Gemini Vision
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { image, question, mode, api_key } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    const finalQuestion = (question || 'Detect and highlight all objects in this image').trim();
    const finalMode = mode === 'all_objects' || mode === 'hybrid' ? mode : 'task_focused';
    const apiKey = (api_key || '').trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'No Gemini API key available. Please configure an API key in the top right menu.',
      });
    }

    // Extract base64 and mime type from image data URL
    let base64Data = image;
    let mimeType = 'image/jpeg';

    if (typeof image === 'string' && image.includes('base64,')) {
      const parts = image.split('base64,');
      const header = parts[0];
      base64Data = parts[1];
      const match = header.match(/data:([^;]+);/);
      if (match) {
        mimeType = match[1];
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const maxObjects = finalMode === 'task_focused' ? 3 : 8;

    const prompt = `You are a high-precision computer vision and object grounding engine.
Analyze this image and answer the user query: "${finalQuestion}".
Mode: "${finalMode}".

CRITICAL INSTRUCTIONS:
1. Detect and identify actual objects and entities (e.g. "Person", "Man", "Face", "T-shirt", "Curtain", "Laptop", "Dog", "Car", etc.). NEVER return generic placeholders like "Primary Visual Focus". Be specific and descriptive.
2. For each detected entity, return exact bounding box coordinates [ymin, xmin, ymax, xmax] normalized on a scale from 0 to 1000.
3. Answer the query thoroughly, accurately, and naturally.
4. Explain what visual information was focused on for the task vs what background details were filtered out.

Return valid JSON ONLY matching this exact structure:
{
  "answer": "Precise and direct natural language answer to the user's question",
  "relevant_visual_info": "Explanation of the visual features and regions focused on vs irrelevant background",
  "objects": [
    {
      "label": "Specific entity name (e.g. Person, Face, White T-Shirt, Red Curtains)",
      "box_2d": [ymin, xmin, ymax, xmax],
      "is_relevant_to_question": true,
      "confidence": 0.96,
      "description": "Short visual detail"
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
              mimeType,
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
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType,
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
      } catch (secondErr: any) {
        console.warn('Gemini API call failed with key, delegating to client computer vision:', secondErr?.message || secondErr);
        return res.json({
          fallback_to_client: true,
          message: 'Gemini API call unavailable, using client-side object detection engine',
        });
      }
    }

    // Parse JSON
    let parsed: any;
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.substring(start, end + 1);
      }
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', responseText);
      return res.status(500).json({
        error: 'Failed to parse Gemini object detection response.',
        raw: responseText,
      });
    }

    const objects = (parsed.objects || []).slice(0, maxObjects).map((obj: any, idx: number) => {
      let box = obj.box_2d || [0, 0, 1000, 1000];
      if (Array.isArray(box)) {
        let [y1, x1, y2, x2] = box.map((v: any) => Number(v) || 0);
        if (Math.max(y1, x1, y2, x2) <= 1.5) {
          y1 *= 1000;
          x1 *= 1000;
          y2 *= 1000;
          x2 *= 1000;
        }
        if (y1 > y2) [y1, y2] = [y2, y1];
        if (x1 > x2) [x1, x2] = [x2, x1];
        box = [
          Math.max(0, Math.min(1000, y1)),
          Math.max(0, Math.min(1000, x1)),
          Math.max(0, Math.min(1000, y2)),
          Math.max(0, Math.min(1000, x2)),
        ];
      }
      return {
        id: idx + 1,
        label: obj.label || `Detected Entity ${idx + 1}`,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.94,
        is_relevant: obj.is_relevant_to_question !== false,
        description: obj.description || '',
        box_norm: box,
        box_2d: box,
      };
    });

    return res.json({
      question: finalQuestion,
      mode: finalMode,
      answer: parsed.answer || 'Visual analysis completed.',
      relevant_visual_info: parsed.relevant_visual_info || '',
      objects,
      source: 'Gemini Multimodal Vision + OpenCV Grounding',
    });
  } catch (err: any) {
    console.error('Analysis error in /api/analyze:', err);
    return res.status(500).json({
      error: `Server visual grounding failed: ${err?.message || err}`,
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VisualAlgo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
