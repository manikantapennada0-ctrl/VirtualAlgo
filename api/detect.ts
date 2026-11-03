import {
  parseRequestBody,
  sendJsonResponse,
  getEffectiveApiKey,
  maskApiKey,
  detectObjectsCore,
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
        message: `HTTP ${req.method} not allowed on /api/detect. Use POST.`,
      },
    });
  }

  try {
    const body = await parseRequestBody(req);
    const apiKey = getEffectiveApiKey(req, body);

    console.log(
      `[API /api/detect] Processing request | Mode: ${body?.mode || 'all'} | Sensitivity: ${body?.sensitivity || 'balanced'} | Key: ${maskApiKey(apiKey)}`
    );

    const result = await detectObjectsCore(body, apiKey);
    return sendJsonResponse(res, 200, result);
  } catch (err: any) {
    console.error('[API /api/detect] Error processing request:', err.message || err);
    return sendJsonResponse(res, 500, {
      success: false,
      error: {
        code: 'DETECTION_PIPELINE_ERROR',
        message: err?.message || 'Detection failed on the AI server.',
      },
    });
  }
}
