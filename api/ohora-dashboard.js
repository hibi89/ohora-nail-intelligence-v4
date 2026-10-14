import { brotliDecompressSync } from 'node:zlib';
import { toPublicDashboardPayload } from '../server/publicDashboard.js';

let cachedDashboardPayload;

function isDashboardPayload(value) {
  return value !== null
    && typeof value === 'object'
    && value.meta !== null
    && typeof value.meta === 'object'
    && typeof value.meta.schemaVersion === 'string'
    && Array.isArray(value.posts)
    && value.posts.every((post) => post && typeof post.postId === 'string')
    && Array.isArray(value.slides)
    && value.slides.every((slide) => slide && typeof slide.postId === 'string' && typeof slide.matchStatus === 'string')
    && value.dataQuality !== null
    && typeof value.dataQuality === 'object';
}

function json(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.end(JSON.stringify(body));
}

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { error: { code: 'method-not-allowed', message: 'Use a read-only GET request.' } });
  }
  if (!cachedDashboardPayload) {
    const compressedPayload = process.env.OHORA_DASHBOARD_BR_BASE64;
    if (!compressedPayload) {
      return json(response, 503, { error: { code: 'snapshot-unavailable', message: 'The authorized analysis snapshot is unavailable.' } });
    }
    try {
      const payloadBuffer = brotliDecompressSync(Buffer.from(compressedPayload, 'base64'), { maxOutputLength: 2_000_000 });
      const sourcePayload = JSON.parse(payloadBuffer.toString('utf8'));
      if (!isDashboardPayload(sourcePayload)) throw new TypeError('Hosted dashboard data does not match its contract.');
      cachedDashboardPayload = toPublicDashboardPayload(sourcePayload);
    } catch (error) {
      return json(response, 503, { error: { code: 'snapshot-invalid', message: 'The authorized analysis data could not be validated.' } });
    }
  }

  return json(response, 200, { data: cachedDashboardPayload });
}
