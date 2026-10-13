import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOhoraV3 } from '../src/data/normalizeOhoraV3.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateSnapshotPath = path.join(projectRoot, 'data', 'private', 'step1-response.json');
const LOOPBACK_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const safeEvidence = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const evidence = {};
  if (typeof value.nails_visible === 'boolean') evidence.nailsVisible = value.nails_visible;
  if (typeof value.background_color === 'string') evidence.backgroundColor = value.background_color.slice(0, 80);
  if (Number.isFinite(value.hand_count) && value.hand_count >= 0) evidence.handCount = value.hand_count;
  if (typeof value.description === 'string') evidence.description = value.description.slice(0, 600);
  return Object.keys(evidence).length ? evidence : null;
};

const warningProjection = (items = []) => items.map(({ code, severity, count, message }) => ({
  code: String(code).slice(0, 80),
  severity: severity === 'error' ? 'error' : 'warning',
  count: Number.isFinite(count) ? count : 1,
  message: String(message).slice(0, 240),
}));

/** Return only the fields needed by the local dashboard, never the raw envelope. */
export function toDashboardPayload(model) {
  return {
    meta: {
      schemaVersion: model.meta.schemaVersion,
      generatedAt: model.meta.generatedAt,
      sourceUpdatedAt: model.meta.sourceUpdatedAt,
      fetchedAt: model.meta.fetchedAt,
      stale: model.meta.stale,
      cached: model.meta.cached,
      demo: model.meta.demo,
    },
    posts: model.posts.map((post) => ({
      postId: post.postId,
      caption: post.caption,
      publishedAt: post.publishedAt,
      permalink: post.permalink,
      isCarousel: post.isCarousel,
      imageCount: post.imageCount,
      carouselChildCount: post.carouselChildCount,
      isDesignPost: post.isDesignPost,
      likes: post.likes,
      comments: post.comments,
      followers: post.followers,
      engagementRatePct: post.engagementRatePct,
    })),
    slides: model.slides.map((slide) => ({
      key: slide.key,
      postId: slide.postId,
      index: slide.index,
      assetId: slide.assetId,
      imageUrl: slide.matchStatus.startsWith('matched') ? slide.imageUrl : null,
      matchStatus: slide.matchStatus,
      isDesignPost: slide.isDesignPost,
      tags: slide.tags,
      visualEvidence: safeEvidence(slide.visualEvidence),
    })),
    dataQuality: {
      summary: model.dataQuality.summary,
      fieldCompleteness: model.dataQuality.fieldCompleteness,
      tagCoverage: model.dataQuality.tagCoverage,
      periodComparison: model.dataQuality.periodComparison,
      warnings: warningProjection(model.dataQuality.warnings),
      errors: warningProjection(model.dataQuality.errors),
    },
  };
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

export function createLocalSnapshotMiddleware({ readSnapshot = () => readFile(privateSnapshotPath, 'utf8') } = {}) {
  return async (request, response) => {
    const peer = request.socket?.remoteAddress;
    if (!LOOPBACK_PEERS.has(peer)) {
      sendJson(response, 403, { error: { code: 'local-only', message: 'This data endpoint is available only to the local development server.' } });
      return;
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      sendJson(response, 405, { error: { code: 'method-not-allowed', message: 'Use a read-only GET request.' } });
      return;
    }

    try {
      const rawText = await readSnapshot();
      const source = JSON.parse(rawText);
      const model = normalizeOhoraV3(source);
      sendJson(response, 200, { data: toDashboardPayload(model) });
    } catch (error) {
      if (error?.code === 'unsupported-schema') {
        sendJson(response, 503, { error: { code: 'unsupported-source', message: 'The local snapshot uses an unsupported data schema.' } });
        return;
      }
      if (error?.code === 'ENOENT') {
        sendJson(response, 503, { error: { code: 'snapshot-unavailable', message: 'The private local snapshot is unavailable.' } });
        return;
      }
      sendJson(response, 503, { error: { code: 'snapshot-invalid', message: 'The local analysis data could not be validated.' } });
    }
  };
}
