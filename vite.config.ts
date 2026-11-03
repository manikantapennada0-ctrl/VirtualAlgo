import { defineConfig, loadEnv } from 'vite';
import {
  parseRequestBody,
  sendJsonResponse,
  getEffectiveApiKey,
  maskApiKey,
  detectObjectsCore,
  chatVisualAssistantCore,
} from './api/_lib/detectionService.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  function setupApiMiddlewares(middlewares: any) {
    // OPTIONS Preflight
    middlewares.use((req: any, res: any, next: any) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-gemini-api-key',
        });
        res.end();
        return;
      }
      next();
    });

    // Health
    middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if ((urlPath === '/api/health' || urlPath === '/api/health/') && req.method === 'GET') {
        const apiKey = getEffectiveApiKey(req) || serverApiKey;
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
          platform: 'vite-dev-middleware',
        });
      }
      next();
    });

    // Unified API routing for /api/detect and /api/chat
    middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (!urlPath.startsWith('/api/')) {
        return next();
      }

      if ((urlPath === '/api/detect' || urlPath === '/api/detect/') && req.method === 'POST') {
        try {
          const body = await parseRequestBody(req);
          const apiKey = getEffectiveApiKey(req, body) || serverApiKey;

          console.log(
            `[Vite Dev /api/detect] Request | Mode: ${body?.mode || 'all'} | Key: ${maskApiKey(apiKey)}`
          );

          const result = await detectObjectsCore(body, apiKey);
          return sendJsonResponse(res, 200, result);
        } catch (error: any) {
          console.error('[Vite Dev /api/detect] Error:', error.message || error);
          return sendJsonResponse(res, 500, {
            success: false,
            error: {
              code: 'DETECTION_ERROR',
              message: error.message || 'Detection failed in dev server.',
            },
          });
        }
      }

      if ((urlPath === '/api/chat' || urlPath === '/api/chat/') && req.method === 'POST') {
        try {
          const body = await parseRequestBody(req);
          const apiKey = getEffectiveApiKey(req, body) || serverApiKey;

          console.log(`[Vite Dev /api/chat] Assistant inquiry | Key: ${maskApiKey(apiKey)}`);

          const result = await chatVisualAssistantCore(body, apiKey);
          return sendJsonResponse(res, 200, result);
        } catch (error: any) {
          console.error('[Vite Dev /api/chat] Error:', error.message || error);
          return sendJsonResponse(res, 500, {
            success: false,
            error: {
              code: 'CHAT_ERROR',
              message: error.message || 'AI conversational inquiry failed.',
            },
          });
        }
      }

      // Guard: any unknown /api/ requests return JSON 404
      return sendJsonResponse(res, 404, {
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `API route not found: ${urlPath}`,
        },
      });
    });
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      {
        name: 'visual-algo-api',
        configureServer(server) {
          setupApiMiddlewares(server.middlewares);
        },
        configurePreview(server) {
          setupApiMiddlewares(server.middlewares);
        },
      },
    ],
  };
});
