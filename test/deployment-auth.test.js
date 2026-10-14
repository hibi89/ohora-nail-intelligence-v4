import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync } from 'node:zlib';
import { createLoginRateLimiter, createPasswordHash, createSessionToken, hasValidSession, isSameOriginRequest, sessionCookie, verifyAccessPassword } from '../server/deploymentAuth.js';
import { normalizeOhoraV3 } from '../src/data/normalizeOhoraV3.js';
import { toDashboardPayload } from '../server/localSnapshotApi.js';
import dashboardHandler from '../api/ohora-dashboard.js';
import loginHandler from '../api/auth/login.js';

const testPassword = 'test-access-code-long-enough-0123456789';
const testSessionSecret = Buffer.alloc(32, 19).toString('base64url');
const testHash = createPasswordHash(testPassword, Buffer.alloc(16, 23));

function mockResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    end(body) { this.body = body; },
  };
}

function authorizedRequest(method = 'GET', now = Date.now()) {
  const token = createSessionToken(testSessionSecret, now);
  return { method, headers: { cookie: sessionCookie(token).split(';')[0], host: 'ohora.example' } };
}

function minimalResponse() {
  return {
    data: {
      source: {},
      analysis: {
        schema_version: 'OHORA_V3_DATA_FIRST',
        generated_at: '2026-10-12T12:00:00Z',
        observations: [{
          id: 'test-post',
          timestamp: '2026-10-12T10:00:00Z',
          image_assets: [],
          ai: { is_design_post: false, slides: [] },
        }],
      },
    },
    cache: { stale: false, cached: false },
  };
}

test('access password verification uses a salted hash', () => {
  assert.equal(verifyAccessPassword(testPassword, testHash), true);
  assert.equal(verifyAccessPassword('wrong access code', testHash), false);
  assert.equal(verifyAccessPassword(testPassword, 'malformed'), false);
});

test('signed access sessions reject missing, expired, and altered cookies', () => {
  const now = Date.parse('2026-10-14T00:00:00Z');
  const token = createSessionToken(testSessionSecret, now, 60);
  assert.equal(hasValidSession({ headers: { cookie: `ohora_session=${token}` } }, testSessionSecret, now), true);
  assert.equal(hasValidSession({ headers: { cookie: `ohora_session=${token}` } }, testSessionSecret, now + 61_000), false);
  assert.equal(hasValidSession({ headers: { cookie: `ohora_session=${token}x` } }, testSessionSecret, now), false);
  assert.equal(hasValidSession({ headers: {} }, testSessionSecret, now), false);
});

test('sign-in accepts same-origin HTTPS only and sets an HttpOnly secure cookie', () => {
  const request = {
    method: 'POST',
    headers: { origin: 'https://ohora.example', host: 'ohora.example', 'x-forwarded-proto': 'https' },
    body: { password: testPassword },
  };
  const response = mockResponse();
  const oldHash = process.env.OHORA_PASSWORD_HASH;
  const oldSecret = process.env.OHORA_SESSION_SECRET;
  process.env.OHORA_PASSWORD_HASH = testHash;
  process.env.OHORA_SESSION_SECRET = testSessionSecret;
  try {
    loginHandler(request, response);
    assert.equal(response.statusCode, 204);
    assert.match(response.headers['set-cookie'], /HttpOnly/);
    assert.match(response.headers['set-cookie'], /Secure/);
    assert.match(response.headers['set-cookie'], /SameSite=Strict/);
  } finally {
    if (oldHash === undefined) delete process.env.OHORA_PASSWORD_HASH;
    else process.env.OHORA_PASSWORD_HASH = oldHash;
    if (oldSecret === undefined) delete process.env.OHORA_SESSION_SECRET;
    else process.env.OHORA_SESSION_SECRET = oldSecret;
  }
});

test('Vercel dashboard API blocks anonymous access and returns only its allowlist to a valid session', () => {
  const oldPayload = process.env.OHORA_DASHBOARD_BR_BASE64;
  const oldSecret = process.env.OHORA_SESSION_SECRET;
  const payload = toDashboardPayload(normalizeOhoraV3(minimalResponse()));
  process.env.OHORA_DASHBOARD_BR_BASE64 = brotliCompressSync(Buffer.from(JSON.stringify(payload))).toString('base64');
  process.env.OHORA_SESSION_SECRET = testSessionSecret;
  try {
    const anonymous = mockResponse();
    dashboardHandler({ method: 'GET', headers: {} }, anonymous);
    assert.equal(anonymous.statusCode, 401);
    assert.equal(JSON.parse(anonymous.body).error.code, 'auth-required');

    const authorized = mockResponse();
    dashboardHandler(authorizedRequest(), authorized);
    assert.equal(authorized.statusCode, 200);
    assert.equal(authorized.headers['cache-control'], 'private, no-store, max-age=0');
    const payload = JSON.parse(authorized.body).data;
    assert.equal(payload.meta.hosted, true);
    assert.equal(payload.posts.length, 1);
    assert.equal('analysis' in payload, false);
    assert.equal('source' in payload, false);
  } finally {
    if (oldPayload === undefined) delete process.env.OHORA_DASHBOARD_BR_BASE64;
    else process.env.OHORA_DASHBOARD_BR_BASE64 = oldPayload;
    if (oldSecret === undefined) delete process.env.OHORA_SESSION_SECRET;
    else process.env.OHORA_SESSION_SECRET = oldSecret;
  }
});

test('login rejects requests without a matching browser Origin', () => {
  const oldHash = process.env.OHORA_PASSWORD_HASH;
  const oldSecret = process.env.OHORA_SESSION_SECRET;
  process.env.OHORA_PASSWORD_HASH = testHash;
  process.env.OHORA_SESSION_SECRET = testSessionSecret;
  try {
    const response = mockResponse();
    loginHandler({ method: 'POST', headers: { origin: 'https://attacker.example', host: 'ohora.example' }, body: { password: testPassword } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).error.code, 'origin-rejected');
  } finally {
    if (oldHash === undefined) delete process.env.OHORA_PASSWORD_HASH;
    else process.env.OHORA_PASSWORD_HASH = oldHash;
    if (oldSecret === undefined) delete process.env.OHORA_SESSION_SECRET;
    else process.env.OHORA_SESSION_SECRET = oldSecret;
  }
});

test('browser login-origin validation rejects cross-site requests', () => {
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://attacker.example', host: 'ohora.example' } }), false);
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://ohora.example', host: 'ohora.example' } }), true);
});

test('login attempt limiter blocks after five failures, expires after its window, and isolates addresses', () => {
  const limiter = createLoginRateLimiter({ windowMs: 60_000, maxFailures: 2 });
  const firstAddress = { ip: '192.0.2.10', headers: {} };
  const secondAddress = { ip: '192.0.2.11', headers: {} };
  const now = 1_800_000_000_000;

  limiter.recordFailure(firstAddress, now);
  limiter.recordFailure(firstAddress, now + 1_000);
  assert.equal(limiter.check(firstAddress, now + 2_000).allowed, false);
  assert.equal(limiter.check(secondAddress, now + 2_000).allowed, true);
  assert.equal(limiter.check(firstAddress, now + 60_001).allowed, true);
});

test('hosted login returns 429 with Retry-After after five bad access codes', () => {
  const oldHash = process.env.OHORA_PASSWORD_HASH;
  const oldSecret = process.env.OHORA_SESSION_SECRET;
  process.env.OHORA_PASSWORD_HASH = testHash;
  process.env.OHORA_SESSION_SECRET = testSessionSecret;
  const ip = `198.51.100.${1 + Math.floor(Math.random() * 200)}`;
  const request = {
    method: 'POST',
    headers: { origin: 'https://ohora.example', host: 'ohora.example', 'x-forwarded-proto': 'https', 'x-forwarded-for': ip },
    body: { password: 'incorrect-access-code' },
  };
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = mockResponse();
      loginHandler(request, response);
      assert.equal(response.statusCode, 401);
    }
    const limited = mockResponse();
    loginHandler(request, limited);
    assert.equal(limited.statusCode, 429);
    assert.match(limited.headers['retry-after'], /^\d+$/);
    assert.equal(JSON.parse(limited.body).error.code, 'login-rate-limited');
  } finally {
    if (oldHash === undefined) delete process.env.OHORA_PASSWORD_HASH;
    else process.env.OHORA_PASSWORD_HASH = oldHash;
    if (oldSecret === undefined) delete process.env.OHORA_SESSION_SECRET;
    else process.env.OHORA_SESSION_SECRET = oldSecret;
  }
});
