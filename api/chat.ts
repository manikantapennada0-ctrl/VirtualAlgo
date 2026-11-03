
import {
  parseRequestBody,
  sendJsonResponse,
  getEffectiveApiKey,
  maskApiKey,
  chatVisualAssistantCore,
  CORS_HEADERS,
} from './_lib/detectionService.ts';

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    if (typeof res.setHeader === 'function') {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    }
    return typeof res.status === 'function' ? res.status(204).end() : (res.writeHead(204, CORS_HEADERS), res.end());
  }

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `HTTP ${req.method} not allowed on /api/chat. Use POST.`,
      },
    });
  }

  try {
    const body = await parseRequestBody(req);
    const apiKey = getEffectiveApiKey(req, body);

    console.log(`[API /api/chat] Inquiring visual assistant | Key: ${maskApiKey(apiKey)}`);

    const result = await chatVisualAssistantCore(body, apiKey);
    return sendJsonResponse(res, 200, result);
  } catch (err: any) {
    console.error('[API /api/chat] Error answering visual inquiry:', err.message || err);
    return sendJsonResponse(res, 500, {
      success: false,
      error: {
        code: 'CHAT_ASSISTANT_ERROR',
        message: err?.message || 'AI conversational inquiry failed.',
      },
    });
  }
}
