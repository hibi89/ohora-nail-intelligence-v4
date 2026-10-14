import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'ohora_session';
export const SESSION_SECONDS = 8 * 60 * 60;
export const LOGIN_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMIT_MAX_FAILURES = 5;

function clientAddress(request) {
  if (typeof request.ip === 'string' && request.ip.trim()) return request.ip.trim();
  const realIp = request.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwardedFor = request.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

export function createLoginRateLimiter({
  windowMs = LOGIN_LIMIT_WINDOW_MS,
  maxFailures = LOGIN_LIMIT_MAX_FAILURES,
  maxEntries = 10_000,
} = {}) {
  const failuresByAddress = new Map();

  function prune(now) {
    for (const [address, entry] of failuresByAddress) {
      if (now - entry.startedAt >= windowMs) failuresByAddress.delete(address);
    }
    while (failuresByAddress.size > maxEntries) {
      failuresByAddress.delete(failuresByAddress.keys().next().value);
    }
  }

  function check(request, now = Date.now()) {
    prune(now);
    const entry = failuresByAddress.get(clientAddress(request));
    if (!entry || entry.failures < maxFailures) return { allowed: true, retryAfterSeconds: 0 };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.startedAt + windowMs - now) / 1000)),
    };
  }

  function recordFailure(request, now = Date.now()) {
    prune(now);
    const address = clientAddress(request);
    const entry = failuresByAddress.get(address);
    if (!entry || now - entry.startedAt >= windowMs) {
      failuresByAddress.set(address, { startedAt: now, failures: 1 });
    } else {
      entry.failures += 1;
    }
    prune(now);
    return check(request, now);
  }

  function clear(request) {
    failuresByAddress.delete(clientAddress(request));
  }

  return { check, recordFailure, clear };
}

// Best-effort per-function-instance protection. Vercel can scale or restart
// instances, so use platform WAF rate limiting for a strict global limit.
export const loginRateLimiter = createLoginRateLimiter();

export function createPasswordHash(password, salt = randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 24) {
    throw new TypeError('The access password must contain at least 24 characters.');
  }
  const derived = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyAccessPassword(password, encodedHash) {
  if (typeof password !== 'string' || password.length > 256 || typeof encodedHash !== 'string') return false;
  const [saltText, hashText, ...extra] = encodedHash.split('$');
  if (!saltText || !hashText || extra.length) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = scryptSync(password, salt, expected.length, { N: 16_384, r: 8, p: 1 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sessionSignature(secret, payload) {
  const key = Buffer.from(secret, 'base64url');
  if (key.length < 32) throw new TypeError('The session signing key is invalid.');
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function createSessionToken(secret, now = Date.now(), lifetimeSeconds = SESSION_SECONDS) {
  const expiresAt = Math.floor(now / 1000) + lifetimeSeconds;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${sessionSignature(secret, payload)}`;
}

function cookieValue(request, name) {
  const cookieHeader = request.headers?.cookie;
  if (typeof cookieHeader !== 'string') return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return null;
}

export function hasValidSession(request, secret, now = Date.now()) {
  if (typeof secret !== 'string') return false;
  const token = cookieValue(request, SESSION_COOKIE_NAME);
  if (!token) return false;
  const [version, expiryText, signature, ...extra] = token.split('.');
  if (version !== 'v1' || !expiryText || !signature || extra.length) return false;
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000)) return false;
  const payload = `${version}.${expiryText}`;
  try {
    const expected = Buffer.from(sessionSignature(secret, payload));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function sessionCookie(token, { secure = true } = {}) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

export function isSameOriginRequest(request) {
  const origin = request.headers?.origin;
  const host = request.headers?.host;
  if (typeof origin !== 'string' || typeof host !== 'string' || !host) return false;
  try {
    const originUrl = new URL(origin);
    const forwardedProtocol = String(request.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const expectedProtocol = forwardedProtocol || (host.startsWith('localhost:') ? 'http' : 'https');
    return originUrl.host.toLowerCase() === host.toLowerCase()
      && originUrl.protocol === `${expectedProtocol}:`
      && ['https:', 'http:'].includes(originUrl.protocol);
  } catch {
    return false;
  }
}
