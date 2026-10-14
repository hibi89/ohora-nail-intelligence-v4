import { TAG_CATEGORIES } from '../src/data/ohoraTypes.js';
import { dateKeyInTimeZone, verifiedPlatformFromPermalink } from '../src/data/selectors.js';

const PUBLIC_DATA_NOTICE = Object.freeze({
  code: 'public-images-included-source-details-omitted',
  severity: 'warning',
  count: 1,
  message: 'Matched Instagram images are shown. Source identifiers, captions, direct post links, visual evidence, and per-post engagement metrics remain omitted.',
});

const APPROVED_IMAGE_HOST = /^scontent-[a-z0-9-]+\.cdninstagram\.com$/i;

function publicTags(tags) {
  return Object.fromEntries(TAG_CATEGORIES.map((category) => [
    category,
    (Array.isArray(tags?.[category]) ? tags[category] : [])
      .filter((value) => typeof value === 'string' && value.trim())
      .slice(0, 30)
      .map((value) => value.trim().slice(0, 80)),
  ]));
}

function publicDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const day = dateKeyInTimeZone(value, 'Asia/Seoul');
  return day ? `${day}T00:00:00+09:00` : null;
}

function approvedPublicImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !APPROVED_IMAGE_HOST.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Publish anonymized classifications plus matched, allowlisted image URLs. */
export function toPublicDashboardPayload(payload) {
  if (!payload || !Array.isArray(payload.posts) || !Array.isArray(payload.slides)) {
    throw new TypeError('A validated dashboard payload is required.');
  }

  const anonymousIdBySourceId = new Map(payload.posts.map((post, index) => [
    post.postId,
    `observation-${String(index + 1).padStart(3, '0')}`,
  ]));

  return {
    meta: {
      schemaVersion: payload.meta.schemaVersion,
      generatedAt: null,
      sourceUpdatedAt: null,
      stale: Boolean(payload.meta.stale),
      cached: Boolean(payload.meta.cached),
      demo: Boolean(payload.meta.demo),
      hosted: true,
      publicView: true,
      publicationScope: 'anonymized-ai-classifications-with-approved-images',
    },
    posts: payload.posts.map((post, index) => ({
      postId: anonymousIdBySourceId.get(post.postId),
      recordLabel: `Observation ${String(index + 1).padStart(3, '0')}`,
      caption: null,
      publishedAt: publicDate(post.publishedAt),
      permalink: null,
      platform: verifiedPlatformFromPermalink(post.permalink),
      isCarousel: null,
      imageCount: null,
      carouselChildCount: null,
      isDesignPost: typeof post.isDesignPost === 'boolean' ? post.isDesignPost : null,
      likes: null,
      comments: null,
      followers: null,
      engagementRatePct: null,
    })),
    slides: payload.slides.flatMap((slide, index) => {
      const postId = anonymousIdBySourceId.get(slide.postId);
      if (!postId) return [];
      const slideIndex = Number.isInteger(slide.index) && slide.index >= 0 ? slide.index : null;
      const imageUrl = slide.matchStatus?.startsWith('matched') ? approvedPublicImageUrl(slide.imageUrl) : null;
      return [{
        key: `${postId}:${slideIndex ?? `unknown-${index + 1}`}`,
        postId,
        index: slideIndex,
        assetId: null,
        imageUrl,
        matchStatus: slide.matchStatus,
        isDesignPost: typeof slide.isDesignPost === 'boolean' ? slide.isDesignPost : null,
        tags: publicTags(slide.tags),
        visualEvidence: null,
      }];
    }),
    dataQuality: {
      summary: {
        publicPostCount: payload.posts.length,
        publicSlideCount: payload.slides.length,
      },
      fieldCompleteness: {},
      tagCoverage: {},
      periodComparison: null,
      warnings: [PUBLIC_DATA_NOTICE],
      errors: [],
    },
  };
}
