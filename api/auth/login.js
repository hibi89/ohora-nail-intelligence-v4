import { createSessionToken, isSameOriginRequest, loginRateLimiter, sessionCookie, verifyAccessPassword } from '../../server/deploymentAuth.js';

function json(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { error: { code: 'method-not-allowed', message: 'Use a same-origin POST request.' } });
  }
  if (!isSameOriginRequest(request)) {
    return json(response, 403, { error: { code: 'origin-rejected', message: 'This sign-in request was rejected.' } });
  }
  const rateLimit = loginRateLimiter.check(request);
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return json(response, 429, { error: { code: 'login-rate-limited', message: 'Too many incorrect attempts. Try again later.' } });
  }

  const password = request.body?.password;
  const passwordHash = process.env.OHORA_PASSWORD_HASH;
  const sessionSecret = process.env.OHORA_SESSION_SECRET;
  if (!passwordHash || !sessionSecret) {
    return json(response, 503, { error: { code: 'auth-unavailable', message: 'Secure access is not configured.' } });
  }
  if (!verifyAccessPassword(password, passwordHash)) {
    loginRateLimiter.recordFailure(request);
    return json(response, 401, { error: { code: 'invalid-access-code', message: 'The access code is incorrect. Try again.' } });
  }

  loginRateLimiter.clear(request);
  const token = createSessionToken(sessionSecret);
  response.setHeader('Set-Cookie', sessionCookie(token, { secure: true }));
  response.status(204).end();
}
