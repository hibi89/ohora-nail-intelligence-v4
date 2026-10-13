import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeOhoraV3 } from '../src/data/normalizeOhoraV3.js';
import { buildDashboardViewModel, buildEngagement, dateKeyInTimeZone, verifiedPlatformFromPermalink } from '../src/data/selectors.js';
import { DECORATIVE_ASSETS, isDecorativeAsset } from '../src/config/decorativeAssets.js';
import { DataContractError } from '../src/data/ohoraSchema.js';
import { createLocalSnapshotMiddleware, toDashboardPayload } from '../server/localSnapshotApi.js';

const snapshotPath = resolve(process.cwd(), 'data/private/step1-response.json');

function minimalResponse({ assets, slides }) {
  return {
    data: {
      source: {},
      analysis: {
        schema_version: 'OHORA_V3_DATA_FIRST',
        generated_at: '2026-10-12T12:00:00Z',
        observations: [{
          id: 'fixture-post',
          caption: 'fixture caption',
          timestamp: '2026-10-12T10:00:00Z',
          image_assets: assets,
          ai: { is_design_post: true, slides },
        }],
      },
    },
    cache: { stale: false, cached: false },
  };
}

test('normalizer refuses positional image fallback when exact index is absent', () => {
  const model = normalizeOhoraV3(minimalResponse({
    assets: [{ id: 'asset-1', index: 1, media_type: 'IMAGE', image_url: 'https://example.test/one.jpg' }],
    slides: [{ index: 2, image_url: 'https://example.test/two.jpg', is_design_post: true }],
  }));
  assert.equal(model.slides[0].matchStatus, 'unmatched-slide');
  assert.equal(model.slides[0].assetId, null);
  assert.equal(model.assets[0].hasAnalysis, false);
  assert.equal(model.dataQuality.summary.matchSuccessCount, 0);
  assert.equal(model.dataQuality.summary.matchFailureCount, 1);
  assert.equal(model.dataQuality.summary.unmatchedAssetCount, 1);
});

test('duplicate indexes and URL conflicts are surfaced as errors', () => {
  const model = normalizeOhoraV3(minimalResponse({
    assets: [
      { id: 'asset-a', index: 1, media_type: 'IMAGE', image_url: 'https://example.test/a.jpg' },
      { id: 'asset-b', index: 1, media_type: 'IMAGE', image_url: 'https://example.test/b.jpg' },
      { id: 'asset-c', index: 2, media_type: 'IMAGE', image_url: 'https://example.test/c.jpg' },
    ],
    slides: [
      { index: 1, image_url: 'https://example.test/a.jpg', is_design_post: true },
      { index: 2, image_url: 'https://example.test/not-c.jpg', is_design_post: true },
    ],
  }));
  assert.equal(model.slides[0].matchStatus, 'ambiguous-index');
  assert.equal(model.slides[1].matchStatus, 'url-mismatch');
  assert.ok(model.dataQuality.errors.some((issue) => issue.code === 'duplicate-asset-index'));
  assert.ok(model.dataQuality.errors.some((issue) => issue.code === 'slide-asset-url-mismatch'));
});

test('duplicate post IDs prevent ambiguous cross-row associations', () => {
  const response = minimalResponse({
    assets: [{ id: 'asset-a', index: 1, media_type: 'IMAGE', image_url: 'https://example.test/a.jpg' }],
    slides: [{ index: 1, image_url: 'https://example.test/a.jpg', is_design_post: true }],
  });
  response.data.analysis.observations.push({ ...response.data.analysis.observations[0] });
  const model = normalizeOhoraV3(response);
  assert.ok(model.slides.every((slide) => slide.matchStatus === 'ambiguous-post-id'));
  assert.ok(model.dataQuality.errors.some((issue) => issue.code === 'duplicate-post-id'));
});

test('schema gate rejects an unsupported source version without echoing source values', () => {
  const response = minimalResponse({ assets: [], slides: [] });
  response.data.analysis.schema_version = 'UNSUPPORTED_FIXTURE_VERSION';
  assert.throws(() => normalizeOhoraV3(response), (error) => {
    assert.ok(error instanceof DataContractError);
    assert.equal(error.code, 'unsupported-schema');
    assert.equal(error.message.includes('UNSUPPORTED_FIXTURE_VERSION'), false);
    return true;
  });
});

test('engagement keeps simple mean and weighted percentage separate', () => {
  const result = buildEngagement([
    { engagementRatePct: 1, likes: 9, comments: 1, followers: 1000 },
    { engagementRatePct: 3, likes: 18, comments: 12, followers: 1000 },
    { engagementRatePct: null, likes: null, comments: 0, followers: 1000 },
  ]);
  assert.equal(result.simpleMeanPct, 2);
  assert.equal(result.simpleMeanSampleSize, 2);
  assert.equal(result.weightedPct, 2);
  assert.equal(result.weightedSampleSize, 2);
  assert.equal(result.missingReportedRateCount, 1);
});

test('calendar date keys use Seoul time while preserving source instants', () => {
  assert.equal(dateKeyInTimeZone('2026-10-01T15:00:00.000Z'), '2026-10-02');
  assert.equal(dateKeyInTimeZone('2026-10-12T14:59:59.000Z'), '2026-10-12');
  assert.equal(dateKeyInTimeZone('2026-10-12T15:00:00.000Z'), '2026-10-13');
});

test('decorative assets are typed slots and remain distinct from analysis images', () => {
  assert.equal(Object.keys(DECORATIVE_ASSETS).length, 4);
  for (const slot of Object.values(DECORATIVE_ASSETS)) {
    assert.equal(isDecorativeAsset(slot), true);
    assert.equal(slot.kind, 'decorative-reference');
    assert.equal(slot.src.startsWith('/assets/'), true);
    assert.equal(slot.status, 'ready');
  }
  assert.equal(isDecorativeAsset({ kind: 'analysis-source' }), false);
});

test('private snapshot produces the approved dynamic KPI values and exact-index integrity', { skip: !existsSync(snapshotPath) }, () => {
  const response = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const model = normalizeOhoraV3(response);
  const view = buildDashboardViewModel(model);
  const kpis = Object.fromEntries(view.kpis.map((item) => [item.id, item.value]));
  assert.deepEqual(kpis, {
    'analyzed-posts': 24,
    'design-slides': 87,
    'active-colors': 18,
    'top-tags': 58,
  });
  assert.equal(model.dataQuality.summary.matchSuccessCount, 97);
  assert.equal(model.dataQuality.summary.matchFailureCount, 0);
  assert.equal(model.dataQuality.summary.unmatchedAssetCount, 3);
  assert.equal(model.dataQuality.summary.designSlideCount, 87);
  assert.equal(model.dataQuality.summary.colorOccurrenceCount, 294);
  assert.equal(model.dataQuality.summary.categoryQualifiedTagCount, 58);
  assert.equal(model.aiResults.length, 24);
  assert.equal(model.colors.length, 294);
  assert.equal(model.tags.length, 349);
  assert.equal(view.engagement.defaultMethod, 'simple-mean-of-valid-post-rates');
  assert.equal(view.engagement.simpleMeanSampleSize, 23);
  assert.ok(Math.abs(view.engagement.simpleMeanPct - 1.0582736730985771) < 1e-12);
  assert.deepEqual(view.filters.dateRange, { from: '2026-10-02', to: '2026-10-12', source: 'dataset-observed-range' });
  assert.deepEqual(view.analysisOverview.dateRange, view.filters.dateRange);
  assert.equal(view.analysisOverview.trend.points.reduce((sum, point) => sum + point.postCount, 0), 24);
  assert.equal(view.combinationTrends.totalCount, view.combinationTrends.denominator);
  assert.equal(view.combinationTrends.denominator, 73);
  const postById = new Map(model.posts.map((post) => [post.postId, post]));
  const overviewColorOccurrences = model.slides
    .filter((slide) => dateKeyInTimeZone(postById.get(slide.postId)?.publishedAt) >= '2026-10-02'
      && dateKeyInTimeZone(postById.get(slide.postId)?.publishedAt) <= '2026-10-12')
    .reduce((sum, slide) => sum + slide.tags.color.length, 0);
  assert.equal(view.analysisOverview.colorDistribution.reduce((sum, item) => sum + item.count, 0), overviewColorOccurrences);
  assert.ok(view.postsTable.rows.every((row) => row.shares === null));
  assert.ok(view.postsTable.rows.every((row) => row.platform === 'Instagram' && row.platformSource === 'validated-instagram-permalink'));

  const filtered = buildDashboardViewModel(model, {
    dateRange: { from: '2026-10-12', to: '2026-10-12' },
    selectedSidebarItem: 'trend-analysis',
    selectedOverviewTab: 'color-distribution',
    tableSort: { key: 'likes', direction: 'asc' },
  });
  assert.ok(filtered.postsTable.rows.length > 0);
  assert.ok(filtered.postsTable.rows.every((row) => dateKeyInTimeZone(row.publishedAt) === '2026-10-12'));
  assert.equal(filtered.sidebar.selectedItem, 'trend-analysis');
  assert.equal(filtered.analysisOverview.activeTab, 'color-distribution');
  const likedRows = filtered.postsTable.rows.filter((row) => row.likes != null);
  assert.ok(likedRows.every((row, index) => index === 0 || likedRows[index - 1].likes <= row.likes));
  const noResults = buildDashboardViewModel(model, { search: 'no-match-query' });
  assert.equal(noResults.kpis.every((item) => item.value === 0), true);
  assert.equal(noResults.postsTable.totalRows, 0);
  assert.equal(noResults.analysisOverview.trend.points.length, 0);

  const reversedRange = buildDashboardViewModel(model, { dateRange: { from: '2026-10-12', to: '2026-10-02' } });
  assert.equal(reversedRange.postsTable.totalRows, 0);
  const invalidSort = buildDashboardViewModel(model, { tableSort: { key: 'unknown-column', direction: 'sideways' } });
  assert.deepEqual(invalidSort.postsTable.sort, { key: 'publishedAt', direction: 'desc' });
  const ascendingEngagement = buildDashboardViewModel(model, { tableSort: { key: 'engagementRatePct', direction: 'asc' } });
  const rates = ascendingEngagement.postsTable.rows.map((row) => row.engagementRatePct);
  assert.equal(rates.at(-1), null);
  const literalPunctuationSearch = buildDashboardViewModel(model, { search: '[.*+?]\\no-match' });
  assert.equal(literalPunctuationSearch.postsTable.totalRows, 0);
});

test('local development API returns a normalized allowlist and accepts GET only', async () => {
  const rawResponse = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const model = normalizeOhoraV3(rawResponse);
  const payload = toDashboardPayload(model);
  assert.equal(payload.posts.length, 24);
  assert.equal(payload.slides.length, 97);
  assert.equal('slideKeys' in payload.posts[0], false);
  assert.equal('calculatedEngagementRatePct' in payload.posts[0], false);
  assert.equal('permalinkHost' in payload.posts[0], false);
  assert.equal('assetId' in payload.slides[0], true);
  assert.equal('isCarousel' in payload.posts[0], true);
  assert.equal('imageCount' in payload.posts[0], true);
  assert.equal('analysis' in payload, false);
  assert.equal('source' in payload, false);
  assert.equal('assets' in payload, false);
  assert.ok(payload.slides.every((slide) => !slide.imageUrl || slide.matchStatus.startsWith('matched')));
  assert.ok(payload.slides.every((slide) => !('visual_evidence' in slide)));

  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = value; },
  };
  await createLocalSnapshotMiddleware({ readSnapshot: async () => JSON.stringify(rawResponse) })(
    { method: 'POST', socket: { remoteAddress: '127.0.0.1' } },
    response,
  );
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET');

  const remoteResponse = { setHeader() {}, end(value) { this.body = value; } };
  await createLocalSnapshotMiddleware({ readSnapshot: async () => { throw new Error('must not read'); } })(
    { method: 'GET', socket: { remoteAddress: '192.0.2.1' } },
    remoteResponse,
  );
  assert.equal(remoteResponse.statusCode, 403);
});

test('platform display requires HTTPS Instagram host and a recognized permalink route', () => {
  assert.equal(verifiedPlatformFromPermalink('https://www.instagram.com/p/abc_123/'), 'Instagram');
  assert.equal(verifiedPlatformFromPermalink('https://www.instagram.com/reel/abc_123/?igsh=local'), 'Instagram');
  assert.equal(verifiedPlatformFromPermalink('http://www.instagram.com/p/abc_123/'), null);
  assert.equal(verifiedPlatformFromPermalink('https://instagram.com.evil.test/p/abc_123/'), null);
  assert.equal(verifiedPlatformFromPermalink('https://www.instagram.com/profile/abc_123/'), null);
  assert.equal(verifiedPlatformFromPermalink('https://www.instagram.com/p/'), null);
  assert.equal(verifiedPlatformFromPermalink('javascript:alert(1)'), null);
});
