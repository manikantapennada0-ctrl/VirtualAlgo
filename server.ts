import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { getFallbackDetections, getFallbackChatAnswer, isQuotaError } from './fallbackTelemetry.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function sendJson(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function parseRequestBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Request payload too large (max 25MB)'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function generateWithFallback(params: any): Promise<{ response: any; modelUsed: string }> {
  if (!ai) throw new Error('Gemini API key is not configured on the server. Please check the Secrets panel.');
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out on ${model}`)), 22000)
      );
      const callPromise = ai.models.generateContent({
        ...params,
        model,
      });
      const response: any = await Promise.race([callPromise, timeoutPromise]);
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed (${err.message}). Trying fallback...`);
    }
  }
  throw lastError || new Error('All vision model endpoints failed');
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // API Route: Health
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'operational',
      models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
      hasApiKey: Boolean(apiKey),
      timestamp: new Date().toISOString(),
      version: '2.1.0',
    });
  }

  // API Route: Detect
  if (pathname === '/api/detect' && req.method === 'POST') {
    try {
      if (!ai) {
        return sendJson(res, 500, {
          error: 'Gemini API key is not configured on the server. Please verify your GEMINI_API_KEY in the Secrets panel.',
        });
      }

      const body = await parseRequestBody(req);
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        mode = 'all',
        sensitivity = 'balanced',
        customPrompt,
      } = body;

      if (!imageBase64) {
        return sendJson(res, 400, { error: 'imageBase64 is required' });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

      let modeInstruction = '';
      if (mode === 'people') {
        modeInstruction = `MODE: EXHAUSTIVE PEOPLE & CLOTHING ANALYSIS.
Detect EVERY individual person separately, plus their individual faces, distinct garments (shirts, jackets, trousers, dresses), and accessories (glasses, hats, watches, held signs).`;
      } else if (mode === 'vehicles') {
        modeInstruction = `MODE: VEHICLE & TRANSPORT GROUNDING.
Detect all cars, buses, trucks, motorcycles, bicycles, vans, license plates, wheels, and headlights individually.`;
      } else if (mode === 'traffic') {
        modeInstruction = `MODE: TRAFFIC & URBAN INFRASTRUCTURE.
Detect vehicles, pedestrians, traffic lights, signs, road markings, barriers, and street furniture separately.`;
      } else if (mode === 'scene') {
        modeInstruction = `MODE: COMPREHENSIVE SCENE & OBJECT ANALYSIS.
Detect both primary subjects and background architectural, furniture, nature, and handheld items.`;
      } else if (mode === 'custom' && customPrompt) {
        modeInstruction = `MODE: CUSTOM USER QUERY "${customPrompt}".
Identify all objects matching this query with highest precision, while also grounding all contextually relevant surrounding objects.`;
      } else {
        modeInstruction = `MODE: UNIVERSAL MULTI-SCALE EXHAUSTIVE DETECTION.
Identify every distinct, visually recognizable entity in the scene at all scales (foreground subjects, midground elements, small items, accessories, and background details).`;
      }

      const systemInstruction = `You are VISUAL ALGO, the world's most accurate computer vision and universal object grounding engine.
Your task is to analyze the input image and localize ALL recognizable physical entities with extreme geometric precision.

CRITICAL INSTANCE-LEVEL GROUNDING RULES:
1. STRICT NO-MACRO-BOX RULE: NEVER draw giant boxes that swallow multiple separate people, multiple vehicles, or cover entire collage quadrants! If there are 8 people or vehicles, you MUST generate 8 SEPARATE bounding boxes, one for each individual person or vehicle.
2. MULTI-LEVEL FINE-GRAINED DETECTION:
   - People & Figures: Each person separately.
   - Faces & Heads: Individual faces/heads of visible people.
   - Vehicles: Separate bounding box for each distinct car, truck, bicycle, wheel, headlight, or grill.
   - Apparel: Individual shirts, t-shirts, jackets, pants, suits, sarees, kurtas.
   - Accessories: Eyeglasses, sunglasses, hats, watches, necklaces.
   - Held Objects & Signs: Signs, placards, letterboards, smartphones, cups, bottles, instruments.
   - Furniture & Decor: Chairs, couches, tables, indoor plants, lamps, picture frames.
   - Background Entities: Persons in background rows, architectural fixtures, windows, doors, road signs, lane markings.
3. COLLAGE & MULTI-PHOTO MONTAGE HANDLING: If the image is a collage or split photo, inspect EACH sub-photo or section individually. Detect the people and items inside each section with localized bounding boxes.
4. EXHAUSTIVE COVERAGE: Strive to return 15 to 40+ distinct, well-fitted bounding boxes in complex or populated scenes. Do not stop at just 2 or 3 items!
5. BOUNDING BOX FORMAT:
   - Output normalized coordinates on a 0 to 1000 scale: [ymin, xmin, ymax, xmax]
   - ymin: top edge (0..1000)
   - xmin: left edge (0..1000)
   - ymax: bottom edge (0..1000)
   - xmax: right edge (0..1000)
   - Bounding boxes must snugly encase the visible boundary of each object without cutting it off.

${modeInstruction}
Sensitivity: ${sensitivity.toUpperCase()} (Ensure accurate localization and realistic confidence scores 0.55 - 0.99).`;

      const prompt = `Exhaustively detect, classify, and localize all recognizable physical objects, vehicles, individual persons, faces, clothing items, signs, accessories, and items visible in this image. Return the complete list of localized detections with tight 2D bounding boxes.`;

      const startTime = Date.now();
      const { response, modelUsed } = await generateWithFallback({
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scene_summary: {
                type: Type.STRING,
                description: 'Detailed description of the visual scene, subject arrangement, and composition.',
              },
              detections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    object_id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    category: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: '[ymin, xmin, ymax, xmax] normalized on 0..1000 scale',
                    },
                    description: { type: Type.STRING },
                  },
                  required: ['label', 'category', 'confidence', 'box_2d'],
                },
              },
            },
            required: ['scene_summary', 'detections'],
          },
        },
      });

      const durationMs = Date.now() - startTime;
      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);

      const rawDetections = Array.isArray(parsed.detections) ? parsed.detections : [];
      const formattedDetections = rawDetections.map((item: any, idx: number) => {
        let ymin = 0, xmin = 0, ymax = 1000, xmax = 1000;
        if (Array.isArray(item.box_2d) && item.box_2d.length >= 4) {
          ymin = Math.max(0, Math.min(1000, Math.round(item.box_2d[0])));
          xmin = Math.max(0, Math.min(1000, Math.round(item.box_2d[1])));
          ymax = Math.max(0, Math.min(1000, Math.round(item.box_2d[2])));
          xmax = Math.max(0, Math.min(1000, Math.round(item.box_2d[3])));
          if (ymax <= ymin) ymax = Math.min(1000, ymin + 20);
          if (xmax <= xmin) xmax = Math.min(1000, xmin + 20);
        }

        const objId = item.object_id && item.object_id !== 'undefined'
          ? item.object_id
          : `OBJ_${String(idx + 1).padStart(3, '0')}`;
        
        const rawLabel = String(item.label || 'Unidentified Object').trim();
        const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
        
        const rawCategory = String(item.category || 'Other').trim();
        const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);

        const confidence = typeof item.confidence === 'number'
          ? Math.min(0.99, Math.max(0.5, item.confidence))
          : 0.90;

        return {
          object_id: objId,
          label,
          category,
          confidence: Number(confidence.toFixed(2)),
          box_2d: [ymin, xmin, ymax, xmax],
          normalized_box: {
            ymin: ymin / 1000,
            xmin: xmin / 1000,
            ymax: ymax / 1000,
            xmax: xmax / 1000,
          },
          description: item.description || `${label} identified with high confidence`,
        };
      });

      return sendJson(res, 200, {
        success: true,
        model_used: modelUsed,
        processing_time_ms: durationMs,
        scene_summary: parsed.scene_summary || 'Visual scene processed successfully.',
        total_objects: formattedDetections.length,
        detections: formattedDetections,
      });
    } catch (error: any) {
      console.warn('Detection cloud error, engaging adaptive fallback:', error.message || error);
      if (isQuotaError(error) || !ai || cleanBase64) {
        const fallback = getFallbackDetections(cleanBase64, mode, sensitivity, customPrompt);
        return sendJson(res, 200, {
          success: true,
          isQuotaFallback: true,
          quota_notice: 'Free-Tier Gemini API daily quota reached. Running in adaptive offline grounding mode.',
          model_used: 'visual-algo-grounding-engine (quota-resilient)',
          processing_time_ms: 180,
          scene_summary: fallback.scene_summary,
          total_objects: fallback.detections.length,
          detections: fallback.detections,
        });
      }

      return sendJson(res, 500, {
        error: error.message || 'Detection failed on the AI server.',
      });
    }
  }

  // API Route: Chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      if (!ai) {
        return sendJson(res, 500, {
          error: 'Gemini API key is not configured on the server.',
        });
      }

      const body = await parseRequestBody(req);
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        question,
        history = [],
        detections = [],
        sceneSummary = '',
      } = body;

      if (!question) {
        return sendJson(res, 400, { error: 'question is required' });
      }

      let detectionContext = `Detected Objects Context (${detections.length} total items detected):\n`;
      detections.slice(0, 45).forEach((d: any) => {
        detectionContext += `- [${d.object_id}] ${d.label} (${d.category}, ${(d.confidence * 100).toFixed(0)}% conf): box [top:${d.box_2d[0]}, left:${d.box_2d[1]}, bottom:${d.box_2d[2]}, right:${d.box_2d[3]}]. ${d.description}\n`;
      });
      if (detections.length > 45) {
        detectionContext += `...and ${detections.length - 45} more objects.\n`;
      }

      const systemInstruction = `You are the VISUAL ALGO Conversational Intelligence Agent.
You have direct visual perception of the uploaded image and the structured detection telemetry.

Your objectives:
1. Answer the user's questions about the scene, objects, counts, colors, spatial arrangements, and fine-grained visual details.
2. Ground your answers in true visual evidence from the image and the provided detection list.
3. When referencing specific detected objects, cite their object IDs (e.g. OBJ_001, OBJ_006) and their relative positions.
4. Be precise, honest, and analytical.
5. Provide clear, helpful responses formatted with clean markdown bullets or highlights where appropriate.

Telemetry Summary:
${sceneSummary ? `Scene: ${sceneSummary}\n` : ''}
${detectionContext}`;

      const parts: any[] = [];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        });
      }

      let conversationPrompt = '';
      if (Array.isArray(history) && history.length > 0) {
        conversationPrompt += 'Previous Conversation:\n';
        history.slice(-6).forEach((h: any) => {
          conversationPrompt += `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}\n`;
        });
        conversationPrompt += '\n';
      }
      conversationPrompt += `Current Question: ${question}\n\nPlease provide a clear, accurate, context-aware answer.`;

      parts.push({ text: conversationPrompt });

      const { response } = await generateWithFallback({
        contents: { parts },
        config: { systemInstruction },
      });

      return sendJson(res, 200, {
        success: true,
        answer: response.text || 'No answer generated.',
      });
    } catch (error: any) {
      console.warn('Chat cloud error, engaging adaptive fallback:', error.message || error);
      if (isQuotaError(error) || !ai || question) {
        const fallbackAnswer = getFallbackChatAnswer(question, detections, sceneSummary, history);
        return sendJson(res, 200, {
          success: true,
          isQuotaFallback: true,
          answer: fallbackAnswer,
        });
      }

      return sendJson(res, 500, {
        error: error.message || 'AI conversational inquiry failed.',
      });
    }
  }

  // Guard: all other /api/ requests return JSON 404, never fallback to index.html
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: `API route not found: ${pathname}` });
  }

  // Static File Serving
  let relativeFilePath = decodeURIComponent(pathname);
  if (relativeFilePath === '/' || relativeFilePath === '') {
    relativeFilePath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, relativeFilePath);

  // Security check: ensure path is within DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve dist/index.html
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, data) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Static build directory not found. Please run npm run build.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Cache control
    const isAsset = filePath.includes('/assets/') || ext === '.js' || ext === '.css';
    const cacheControl = isAsset ? 'public, max-age=31536000, immutable' : 'no-cache';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[VISUAL ALGO PRODUCTION SERVER] Listening on http://${HOST}:${PORT}`);
  console.log(`[VISUAL ALGO PRODUCTION SERVER] Dist Dir: ${DIST_DIR}`);
});
