import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync } from 'node:zlib';
import { toPublicDashboardPayload } from '../server/publicDashboard.js';
import dashboardHandler from '../api/ohora-dashboard.js';

function mockResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    end(body) { this.body = body; },
  };
}

function sourcePayload() {
  return {
    meta: { schemaVersion: 'OHORA_V3_DATA_FIRST', generatedAt: '2026-10-12T12:00:00Z', sourceUpdatedAt: null, stale: false, cached: false, demo: false },
    posts: [{
      postId: 'source-post-id-secret',
      caption: 'private source caption',
      publishedAt: '2026-10-12T11:23:12Z',
      permalink: 'https://www.instagram.com/p/AbC123/',
      isCarousel: true,
      imageCount: 3,
      carouselChildCount: 3,
      isDesignPost: true,
      likes: 121,
      comments: 17,
      followers: 1000,
      engagementRatePct: 13.8,
    }],
    slides: [{
      key: 'source-post-id-secret:0',
      postId: 'source-post-id-secret',
      index: 0,
      assetId: 'source-asset-id-secret',
      imageUrl: 'https://cdn.example.invalid/source-image-secret.jpg',
      matchStatus: 'matched',
      isDesignPost: true,
      tags: { color: ['Cherry'], technique: ['Glazed'], texture: [], motif: ['Floral'], season: [], use: ['Daily'] },
      visualEvidence: { description: 'private source visual evidence' },
    }],
    dataQuality: { summary: { imageAssetCount: 1 }, fieldCompleteness: {}, tagCoverage: {}, periodComparison: null, warnings: [], errors: [] },
  };
}

test('public dashboard projection removes source identifiers, text, media, and per-post metrics', () => {
  const publicData = toPublicDashboardPayload(sourcePayload());
  const serialized = JSON.stringify(publicData);
  for (const sourceOnlyValue of [
    'source-post-id-secret', 'private source caption', 'source-asset-id-secret',
    'source-image-secret.jpg', 'private source visual evidence', '13.8', '121', '1000',
  ]) assert.equal(serialized.includes(sourceOnlyValue), false);

  assert.equal(publicData.meta.publicView, true);
  assert.equal(publicData.meta.generatedAt, null);
  assert.equal(publicData.meta.sourceUpdatedAt, null);
  assert.equal(publicData.posts[0].postId, 'observation-001');
  assert.equal(publicData.posts[0].recordLabel, 'Observation 001');
  assert.equal(publicData.posts[0].publishedAt, '2026-10-12T00:00:00+09:00');
  assert.equal(publicData.posts[0].platform, 'Instagram');
  assert.equal(publicData.posts[0].permalink, null);
  assert.equal(publicData.posts[0].likes, null);
  assert.equal(publicData.slides[0].postId, 'observation-001');
  assert.equal(publicData.slides[0].index, 0);
  assert.equal(publicData.slides[0].imageUrl, null);
  assert.equal(publicData.slides[0].assetId, null);
  assert.equal(publicData.slides[0].visualEvidence, null);
  assert.deepEqual(publicData.slides[0].tags.color, ['Cherry']);
});

test('Vercel dashboard GET is public but serves only the anonymized allowlist', () => {
  const oldPayload = process.env.OHORA_DASHBOARD_BR_BASE64;
  process.env.OHORA_DASHBOARD_BR_BASE64 = brotliCompressSync(Buffer.from(JSON.stringify(sourcePayload()))).toString('base64');
  try {
    const response = mockResponse();
    dashboardHandler({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store, max-age=0');
    const body = JSON.parse(response.body);
    assert.equal(body.data.meta.publicView, true);
    assert.equal(body.data.posts.length, 1);
    assert.equal(body.data.posts[0].postId, 'observation-001');
    assert.equal(JSON.stringify(body).includes('source-post-id-secret'), false);
    assert.equal(JSON.stringify(body).includes('source-image-secret'), false);

    const wrongMethod = mockResponse();
    dashboardHandler({ method: 'POST', headers: {} }, wrongMethod);
    assert.equal(wrongMethod.statusCode, 405);
  } finally {
    if (oldPayload === undefined) delete process.env.OHORA_DASHBOARD_BR_BASE64;
    else process.env.OHORA_DASHBOARD_BR_BASE64 = oldPayload;
  }
});
