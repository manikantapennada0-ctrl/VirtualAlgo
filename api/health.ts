import {
  sendJsonResponse,
  getEffectiveApiKey,
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
    platform: 'vercel-serverless',
  });
}
