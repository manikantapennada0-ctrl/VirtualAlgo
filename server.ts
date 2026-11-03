import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRequestBody,
  sendJsonResponse,
  getEffectiveApiKey,
  maskApiKey,
  detectObjectsCore,
  chatVisualAssistantCore,
  CORS_HEADERS,
} from './api/_lib/detectionService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

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

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // API Route: Health
  if (pathname === '/api/health' && req.method === 'GET') {
    const apiKey = getEffectiveApiKey(req);
    return sendJsonResponse(res, 200, {
      status: 'operational',
      success: true,
      models: [
        process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
      ],
      hasApiKey: Boolean(apiKey),
      timestamp: new Date().toISOString(),
      version: '2.2.0',
      platform: 'node-http-server',
    });
  }

  // API Route: Detect & Analyze
  if ((pathname === '/api/detect' || pathname === '/api/analyze') && req.method === 'POST') {
    try {
      const rawBody = await parseRequestBody(req);
      const apiKey = getEffectiveApiKey(req, rawBody);

      const normalizedBody = {
        imageBase64: rawBody?.imageBase64 || rawBody?.image || '',
        mimeType: rawBody?.mimeType || 'image/jpeg',
        mode: rawBody?.mode === 'all_objects' ? 'all' : rawBody?.mode || 'all',
        sensitivity: rawBody?.sensitivity || 'balanced',
        customPrompt: rawBody?.customPrompt || rawBody?.question || '',
        apiKey,
      };

      console.log(
        `[HTTP ${pathname}] Processing request | Mode: ${normalizedBody.mode} | Key: ${maskApiKey(apiKey)}`
      );

      const result = await detectObjectsCore(normalizedBody, apiKey);
      const enriched = {
        ...result,
        answer: result.scene_summary || result.description,
        inference_time_ms: result.processing_time_ms,
        relevant_visual_info: (result.objects || [])
          .map((o: any, i: number) => `#${i + 1} ${o.label} [${o.category}] — ${Math.round(o.confidence * 100)}%`)
          .join(' | '),
      };

      return sendJsonResponse(res, 200, enriched);
    } catch (error: any) {
      console.error(`[HTTP ${pathname}] Error:`, error.message || error);
      return sendJsonResponse(res, 500, {
        success: false,
        error: {
          code: 'DETECTION_ERROR',
          message: error.message || 'Detection failed on the AI server.',
        },
      });
    }
  }

  // API Route: Chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const apiKey = getEffectiveApiKey(req, body);

      console.log(`[HTTP /api/chat] Assistant inquiry | Key: ${maskApiKey(apiKey)}`);

      const result = await chatVisualAssistantCore(body, apiKey);
      return sendJsonResponse(res, 200, result);
    } catch (error: any) {
      console.error('[HTTP /api/chat] Error:', error.message || error);
      return sendJsonResponse(res, 500, {
        success: false,
        error: {
          code: 'CHAT_ERROR',
          message: error.message || 'AI conversational inquiry failed.',
        },
      });
    }
  }

  // Guard: all other /api/ requests return JSON 404
  if (pathname.startsWith('/api/')) {
    return sendJsonResponse(res, 404, {
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `API route not found: ${pathname}`,
      },
    });
  }

  // Static File Serving
  let relativeFilePath = decodeURIComponent(pathname);
  if (relativeFilePath === '/' || relativeFilePath === '') {
    relativeFilePath = '/index.html';
  }

  const filePath = path.join(DIST_DIR, relativeFilePath);

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
