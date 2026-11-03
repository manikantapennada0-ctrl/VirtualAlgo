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
        message: `HTTP ${req.method} not allowed on /api/analyze. Use POST.`,
      },
    });
  }

  try {
    const rawBody = await parseRequestBody(req);
    const apiKey = getEffectiveApiKey(req, rawBody);

    // Support both modern parameters and legacy parameters (image, question, all_objects)
    const normalizedBody = {
      imageBase64: rawBody?.imageBase64 || rawBody?.image || '',
      mimeType: rawBody?.mimeType || 'image/jpeg',
      mode: rawBody?.mode === 'all_objects' ? 'all' : rawBody?.mode || 'all',
      sensitivity: rawBody?.sensitivity || 'balanced',
      customPrompt: rawBody?.customPrompt || rawBody?.question || '',
      apiKey,
    };

    console.log(
      `[API /api/analyze] Processing request | Mode: ${normalizedBody.mode} | Key: ${maskApiKey(apiKey)}`
    );

    const result = await detectObjectsCore(normalizedBody, apiKey);

    // Include backward-compatible legacy fields
    const enriched = {
      ...result,
      answer: result.scene_summary || result.description,
      inference_time_ms: result.processing_time_ms,
      relevant_visual_info: (result.objects || [])
        .map((o: any, i: number) => `#${i + 1} ${o.label} [${o.category}] — ${Math.round(o.confidence * 100)}%`)
        .join(' | '),
    };

    return sendJsonResponse(res, 200, enriched);
  } catch (err: any) {
    console.error('[API /api/analyze] Error processing request:', err.message || err);
    return sendJsonResponse(res, 500, {
      success: false,
      error: {
        code: 'DETECTION_PIPELINE_ERROR',
        message: err?.message || 'Detection failed on the AI server.',
      },
    });
  }
}
