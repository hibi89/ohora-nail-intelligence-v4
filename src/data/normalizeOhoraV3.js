import { TAG_CATEGORIES } from './ohoraTypes.js';
import { validateOhoraResponse } from './ohoraSchema.js';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const toId = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const toNonNegativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const slideKeyOf = (postId, index) => JSON.stringify([postId, index]);

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function isoTimestamp(value) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function hostOf(value) {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase(); } catch { return null; }
}

function addIssue(issues, code, severity, count, message) {
  if (count > 0) issues.push({ code, severity, count, message });
}

function normalizeTags(value, category, issues) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid-tag-field', 'warning', 1, `Tag field ${category} was not an array.`);
    return [];
  }
  const tags = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') {
      addIssue(issues, 'invalid-tag-value', 'warning', 1, `Tag field ${category} contained a non-string value.`);
      continue;
    }
    const tag = item.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function numericField(value, fieldName, issues) {
  if (value == null) return null;
  const number = toNonNegativeNumber(value);
  if (number == null) addIssue(issues, `invalid-${fieldName}`, 'warning', 1, `Field ${fieldName} was not a finite non-negative number.`);
  return number;
}

/**
 * Normalize the approved OHORA v3 response. Image associations are exact-index
 * only; missing, duplicate, or URL-conflicting matches are never repaired by
 * array position.
 *
 * @param {unknown} response
 * @returns {import('./ohoraTypes.js').NormalizedOhoraData}
 */
export function normalizeOhoraV3(response) {
  const { analysis, source, cache, fetchedAt, warnings: envelopeWarnings } = validateOhoraResponse(response);
  const issues = [];
  for (const warning of envelopeWarnings) addIssue(issues, warning.code, 'warning', 1, warning.message);

  const observations = analysis.observations;
  const idCounts = new Map();
  for (const observation of observations) {
    const id = toId(observation?.id);
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const duplicatePostIdCount = [...idCounts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  addIssue(issues, 'duplicate-post-id', 'error', duplicatePostIdCount, 'Duplicate post IDs make post and slide keys ambiguous.');

  /** @type {import('./ohoraTypes.js').NormalizedPost[]} */
  const posts = [];
  /** @type {import('./ohoraTypes.js').NormalizedAsset[]} */
  const assets = [];
  /** @type {import('./ohoraTypes.js').NormalizedSlide[]} */
  const slides = [];
  const aiResults = [];
  const perPostCountComparisons = [];
  let missingPostIdCount = 0;
  let invalidTimestampCount = 0;
  let invalidAssetIndexCount = 0;
  let invalidSlideIndexCount = 0;
  let duplicateAssetIndexCount = 0;
  let duplicateSlideIndexCount = 0;
  let invalidAssetUrlCount = 0;
  let invalidSlideUrlCount = 0;
  let missingAiSlidesPostCount = 0;
  const ambiguousAssetKeys = new Set();
  const duplicateSlideKeys = new Set();

  observations.forEach((observation) => {
    const postId = toId(observation?.id);
    if (!postId) {
      missingPostIdCount += 1;
      addIssue(issues, 'missing-post-id', 'error', 1, 'An observation has no usable post ID.');
      return;
    }
    const ambiguousPostId = idCounts.get(postId) > 1;
    const ai = isRecord(observation.ai) ? observation.ai : {};
    const rawSlides = Array.isArray(ai.slides) ? ai.slides : [];
    if (!Array.isArray(ai.slides) || rawSlides.length === 0) missingAiSlidesPostCount += 1;

    const rawAssets = Array.isArray(observation.image_assets) ? observation.image_assets : [];
    perPostCountComparisons.push({
      imageCount: toNonNegativeNumber(observation?.image_count),
      assetCount: rawAssets.length,
      slideCount: rawSlides.length,
      carouselChildCount: toNonNegativeNumber(observation?.carousel_child_count),
    });
    const assetIndexCounts = new Map();
    for (const rawAsset of rawAssets) {
      if (!Number.isInteger(rawAsset?.index)) {
        invalidAssetIndexCount += 1;
        continue;
      }
      const key = `${postId}\u0000${rawAsset.index}`;
      assetIndexCounts.set(key, (assetIndexCounts.get(key) || 0) + 1);
    }
    for (const [key, count] of assetIndexCounts) {
      if (count > 1) {
        duplicateAssetIndexCount += count - 1;
        ambiguousAssetKeys.add(key);
      }
    }

    const postAssets = rawAssets.map((rawAsset) => {
      const index = Number.isInteger(rawAsset?.index) ? rawAsset.index : null;
      const url = safeHttpUrl(rawAsset?.image_url);
      if (rawAsset?.image_url != null && !url) invalidAssetUrlCount += 1;
      const id = toId(rawAsset?.id);
      if (!id) addIssue(issues, 'missing-asset-id', 'warning', 1, 'An image asset has no usable asset ID.');
      return {
        assetId: id,
        postId,
        index,
        mediaType: typeof rawAsset?.media_type === 'string' ? rawAsset.media_type : null,
        url,
        hasAnalysis: false,
        matchedSlideKey: null,
      };
    });
    const assetsByIndex = new Map();
    postAssets.forEach((asset) => {
      if (asset.index == null) return;
      const key = `${postId}\u0000${asset.index}`;
      assetsByIndex.set(key, [...(assetsByIndex.get(key) || []), asset]);
    });

    const postSlides = [];
    const slideIndexCounts = new Map();
    rawSlides.forEach((rawSlide) => {
      if (Number.isInteger(rawSlide?.index)) {
        slideIndexCounts.set(rawSlide.index, (slideIndexCounts.get(rawSlide.index) || 0) + 1);
      }
    });
    for (const [index, count] of slideIndexCounts) {
      if (count > 1) {
        duplicateSlideIndexCount += count - 1;
        duplicateSlideKeys.add(slideKeyOf(postId, index));
      }
    }

    rawSlides.forEach((rawSlide) => {
      const index = Number.isInteger(rawSlide?.index) ? rawSlide.index : null;
      if (index == null) invalidSlideIndexCount += 1;
      const key = index == null ? null : slideKeyOf(postId, index);
      const safeSlideUrl = safeHttpUrl(rawSlide?.image_url);
      if (rawSlide?.image_url != null && !safeSlideUrl) invalidSlideUrlCount += 1;
      const indexKey = index == null ? null : `${postId}\u0000${index}`;
      const candidates = indexKey ? (assetsByIndex.get(indexKey) || []) : [];
      const ambiguous = (indexKey && ambiguousAssetKeys.has(indexKey)) || (key && duplicateSlideKeys.has(key));
      const asset = !ambiguous && candidates.length === 1 ? candidates[0] : null;
      let matchStatus = 'unmatched-slide';
      if (ambiguousPostId) matchStatus = 'ambiguous-post-id';
      else if (index == null) matchStatus = 'invalid-index';
      else if (ambiguous || candidates.length > 1) matchStatus = 'ambiguous-index';
      else if (asset) {
        if (safeSlideUrl && asset.url && safeSlideUrl !== asset.url) {
          matchStatus = 'url-mismatch';
          addIssue(issues, 'slide-asset-url-mismatch', 'error', 1, 'A slide and exact-index asset have different safe URLs.');
        } else {
          matchStatus = safeSlideUrl && asset.url ? 'matched' : 'matched-index-only';
          asset.hasAnalysis = true;
          asset.matchedSlideKey = key;
        }
      }

      const tags = Object.fromEntries(TAG_CATEGORIES.map((category) => [category, normalizeTags(rawSlide?.[category], category, issues)]));
      const imageUrl = safeSlideUrl || (asset && matchStatus.startsWith('matched') ? asset.url : null);
      const slide = {
        key,
        postId,
        index,
        imageUrl,
        imageUrlSource: safeSlideUrl ? 'slide' : (imageUrl ? 'exact-index-asset' : 'none'),
        assetId: asset && matchStatus.startsWith('matched') ? asset.assetId : null,
        matchStatus,
        isDesignPost: typeof rawSlide?.is_design_post === 'boolean' ? rawSlide.is_design_post : null,
        tags,
        visualEvidence: rawSlide?.visual_evidence ?? null,
      };
      if (key && duplicateSlideKeys.has(key)) slide.key = null;
      slides.push(slide);
      postSlides.push(slide);
    });

    const postIndexAssets = postAssets;
    const timestamp = isoTimestamp(observation?.timestamp);
    if (!timestamp) invalidTimestampCount += 1;
    const likes = numericField(observation?.likes, 'likes', issues);
    const comments = numericField(observation?.comments, 'comments', issues);
    const followers = numericField(observation?.followers, 'followers', issues);
    const engagementRatePct = numericField(observation?.engagement, 'engagement', issues);
    const calculatedEngagementRatePct = likes != null && comments != null && followers > 0
      ? ((likes + comments) / followers) * 100
      : null;
    posts.push({
      postId,
      caption: typeof observation?.caption === 'string' ? observation.caption : null,
      publishedAt: timestamp,
      permalink: safeHttpUrl(observation?.permalink),
      permalinkHost: hostOf(safeHttpUrl(observation?.permalink)),
      explicitPlatform: typeof observation?.platform === 'string' ? observation.platform : null,
      mediaType: typeof observation?.media_type === 'string' ? observation.media_type : null,
      isCarousel: typeof observation?.is_carousel === 'boolean' ? observation.is_carousel : null,
      imageCount: toNonNegativeNumber(observation?.image_count),
      carouselChildCount: toNonNegativeNumber(observation?.carousel_child_count),
      isDesignPost: typeof ai.is_design_post === 'boolean' ? ai.is_design_post : null,
      likes,
      comments,
      followers,
      engagementRatePct,
      calculatedEngagementRatePct,
      visualEvidence: observation?.visual_evidence ?? null,
      slideKeys: postSlides.map((slide) => slide.key).filter(Boolean),
      assetIds: postIndexAssets.map((asset) => asset.assetId).filter(Boolean),
    });
    aiResults.push({
      postId,
      isDesignPost: typeof ai.is_design_post === 'boolean' ? ai.is_design_post : null,
      visionStatus: typeof observation?.vision_status === 'string' ? observation.vision_status : null,
      analyzedImageCount: toNonNegativeNumber(observation?.analyzed_image_count),
      visualEvidence: ai.visual_evidence ?? observation?.visual_evidence ?? null,
      slideKeys: postSlides.map((slide) => slide.key).filter(Boolean),
      success: postSlides.length > 0,
    });
    assets.push(...postAssets);
  });

  addIssue(issues, 'missing-ai-slides', 'warning', missingAiSlidesPostCount, 'Observations with no ai.slides array or no slide results.');
  addIssue(issues, 'invalid-timestamp', 'warning', invalidTimestampCount, 'Posts with an invalid or missing timestamp.');
  addIssue(issues, 'invalid-asset-index', 'error', invalidAssetIndexCount, 'Assets with a missing or non-integer index cannot be joined.');
  addIssue(issues, 'invalid-slide-index', 'error', invalidSlideIndexCount, 'Slides with a missing or non-integer index cannot be joined.');
  addIssue(issues, 'duplicate-asset-index', 'error', duplicateAssetIndexCount, 'Duplicate asset indexes make exact matching ambiguous.');
  addIssue(issues, 'duplicate-slide-index', 'error', duplicateSlideIndexCount, 'Duplicate slide indexes make composite slide keys ambiguous.');
  addIssue(issues, 'invalid-asset-url', 'warning', invalidAssetUrlCount, 'Assets with an invalid or unsupported URL cannot be displayed.');
  addIssue(issues, 'invalid-slide-url', 'warning', invalidSlideUrlCount, 'Slides with an invalid or unsupported URL cannot be displayed.');

  const matchedSlides = slides.filter((slide) => slide.matchStatus.startsWith('matched'));
  const unmatchedSlides = slides.filter((slide) => !slide.matchStatus.startsWith('matched'));
  const unmatchedAssets = assets.filter((asset) => !asset.hasAnalysis);
  addIssue(issues, 'unmatched-slide', 'error', unmatchedSlides.length, 'AI slides without a safe exact-index asset match.');
  addIssue(issues, 'unmatched-asset', 'warning', unmatchedAssets.length, 'Image assets without a corresponding AI slide.');

  const designSlideCount = slides.filter((slide) => slide.isDesignPost === true).length;
  const nonDesignSlideCount = slides.filter((slide) => slide.isDesignPost === false).length;
  const unknownSlideClassificationCount = slides.length - designSlideCount - nonDesignSlideCount;
  const designPostCount = posts.filter((post) => post.isDesignPost === true).length;
  const nonDesignPostCount = posts.filter((post) => post.isDesignPost === false).length;
  const mixedClassifiedPosts = posts.filter((post) => {
    const postSlides = slides.filter((slide) => slide.postId === post.postId);
    return post.isDesignPost === true && postSlides.some((slide) => slide.isDesignPost === true)
      && postSlides.some((slide) => slide.isDesignPost === false);
  }).length;
  addIssue(issues, 'mixed-post-slide-classification', 'warning', mixedClassifiedPosts, 'A post-level design flag coexists with mixed slide-level classification.');

  const tagCoverage = Object.fromEntries(TAG_CATEGORIES.map((category) => {
    const filledSlideCount = slides.filter((slide) => slide.tags[category].length > 0).length;
    const emptySlideCount = slides.length - filledSlideCount;
    return [category, {
      filledSlideCount,
      emptySlideCount,
      totalSlideCount: slides.length,
      coverageRate: slides.length ? filledSlideCount / slides.length : 0,
      occurrenceCount: slides.reduce((sum, slide) => sum + slide.tags[category].length, 0),
      uniqueValueCount: new Set(slides.flatMap((slide) => slide.tags[category])).size,
    }];
  }));
  const colors = slides.flatMap((slide) => slide.tags.color.map((label) => ({
    key: JSON.stringify([slide.postId, slide.index, 'color', label]),
    postId: slide.postId,
    slideIndex: slide.index,
    label,
  })));
  const tags = slides.flatMap((slide) => TAG_CATEGORIES
    .filter((category) => category !== 'color')
    .flatMap((category) => slide.tags[category].map((value) => ({
      key: JSON.stringify([slide.postId, slide.index, category, value]),
      postId: slide.postId,
      slideIndex: slide.index,
      category,
      value,
    }))));
  const categoryQualifiedTagCount = new Set([
    ...colors.map((color) => JSON.stringify(['color', color.label])),
    ...tags.map((tag) => JSON.stringify([tag.category, tag.value])),
  ]).size;
  const uniqueColorCount = new Set(colors.map((color) => color.label)).size;

  const fieldCompleteness = {};
  const fieldValue = {
    likes: (post) => post.likes,
    comments: (post) => post.comments,
    followers: (post) => post.followers,
    engagement: (post) => post.engagementRatePct,
    timestamp: (post) => post.publishedAt,
    platform: (post) => post.explicitPlatform,
    shares: () => null,
  };
  for (const [field, getter] of Object.entries(fieldValue)) {
    const present = posts.filter((post) => getter(post) != null).length;
    fieldCompleteness[field] = {
      total: posts.length,
      present,
      missing: posts.length - present,
      missingRate: posts.length ? (posts.length - present) / posts.length : 0,
    };
  }

  addIssue(issues, 'missing-metric-values', 'warning', fieldCompleteness.likes.missing + fieldCompleteness.engagement.missing, 'Likes and/or engagement values are absent; nulls are preserved.');
  addIssue(issues, 'platform-field-absent', 'warning', fieldCompleteness.platform.missing, 'No explicit platform field is available.');
  addIssue(issues, 'shares-field-absent', 'warning', fieldCompleteness.shares.missing, 'No share-count field is available.');

  const uniquePostIds = new Set(posts.map((post) => post.postId)).size;
  const analyzedPostCount = new Set(slides.map((slide) => slide.postId)).size;
  const uniqueAssetIds = new Set(assets.map((asset) => asset.assetId).filter(Boolean)).size;
  const duplicateAssetIdCount = assets.filter((asset) => asset.assetId != null).length - uniqueAssetIds;
  addIssue(issues, 'duplicate-asset-id', 'error', duplicateAssetIdCount, 'Duplicate asset IDs make the asset identity ambiguous.');
  const reportedCounts = {
    aiSuccessCount: Number.isFinite(analysis.aiSuccessCount) ? analysis.aiSuccessCount : null,
    aiTotalCount: Number.isFinite(analysis.aiTotalCount) ? analysis.aiTotalCount : null,
    totalImageCount: Number.isFinite(analysis.totalImageCount) ? analysis.totalImageCount : null,
    analyzedSlideCount: Number.isFinite(analysis.analyzedSlideCount) ? analysis.analyzedSlideCount : null,
  };
  const counterDiscrepancies = [];
  const compareReportedCount = (field, actual) => {
    const reported = reportedCounts[field];
    if (reported != null && reported !== actual) counterDiscrepancies.push({ field, reported, actual });
  };
  compareReportedCount('aiSuccessCount', analyzedPostCount);
  compareReportedCount('aiTotalCount', observations.length);
  compareReportedCount('totalImageCount', slides.length);
  compareReportedCount('analyzedSlideCount', slides.length);
  addIssue(issues, 'reported-count-mismatch', 'warning', counterDiscrepancies.length, 'A source aggregate does not match normalized records.');
  const imageCountVsSlideMismatchPostCount = perPostCountComparisons.filter((item) => item.imageCount != null && item.imageCount !== item.slideCount).length;
  const imageCountVsAssetMismatchPostCount = perPostCountComparisons.filter((item) => item.imageCount != null && item.imageCount !== item.assetCount).length;
  const carouselChildCountEqualsAssetCountPostCount = perPostCountComparisons.filter((item) => item.carouselChildCount != null && item.carouselChildCount === item.assetCount).length;
  addIssue(issues, 'image-count-asset-count-divergence', 'warning', imageCountVsAssetMismatchPostCount, 'The source image_count and image_assets length use different counts for one or more posts.');
  addIssue(issues, 'image-count-slide-count-divergence', 'warning', imageCountVsSlideMismatchPostCount, 'The source image_count and normalized AI slide count differ for one or more posts.');
  addIssue(issues, 'comparison-coverage-unverified', 'warning', 1, 'The source does not provide collection coverage metadata for reliable period growth comparisons.');
  const sortedTimestamps = posts.map((post) => post.publishedAt).filter(Boolean).sort();
  const assetMediaTypeCounts = Object.fromEntries([...new Set(assets.map((asset) => asset.mediaType || 'unknown'))]
    .map((mediaType) => [mediaType, assets.filter((asset) => (asset.mediaType || 'unknown') === mediaType).length]));
  const slideMatchStatusCounts = Object.fromEntries([...new Set(slides.map((slide) => slide.matchStatus))]
    .map((matchStatus) => [matchStatus, slides.filter((slide) => slide.matchStatus === matchStatus).length]));
  const dataQuality = {
    summary: {
      observationCount: observations.length,
      postCount: posts.length,
      uniquePostIdCount: uniquePostIds,
      analyzedPostCount,
      duplicatePostIdCount,
      missingPostIdCount,
      duplicateAssetIdCount,
      slideCount: slides.length,
      aiResultCount: aiResults.length,
      aiSuccessPostCount: aiResults.filter((result) => result.success).length,
      imageAssetCount: assets.length,
      uniqueAssetIdCount: uniqueAssetIds,
      matchSuccessCount: matchedSlides.length,
      matchFailureCount: unmatchedSlides.length,
      unmatchedSlideCount: unmatchedSlides.length,
      unmatchedAssetCount: unmatchedAssets.length,
      designPostCount,
      nonDesignPostCount,
      designSlideCount,
      nonDesignSlideCount,
      unknownSlideClassificationCount,
      colorOccurrenceCount: colors.length,
      uniqueColorCount,
      tagOccurrenceCount: colors.length + tags.length,
      categoryQualifiedTagCount,
      imageCountVsSlideMismatchPostCount,
      imageCountVsAssetMismatchPostCount,
      carouselChildCountEqualsAssetCountPostCount,
      assetMediaTypeCounts,
      slideMatchStatusCounts,
    },
    reportedCounts,
    counterDiscrepancies,
    dateRange: {
      from: sortedTimestamps[0] || null,
      to: sortedTimestamps.at(-1) || null,
    },
    periodComparison: {
      available: false,
      coverageStatus: 'unverified',
      reason: 'collection-coverage-metadata-absent',
    },
    fieldCompleteness,
    tagCoverage,
    mixedClassifiedPostCount: mixedClassifiedPosts,
    invalidTimestampCount,
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    errors: issues.filter((issue) => issue.severity === 'error'),
  };

  return {
    meta: {
      schemaVersion: analysis.schema_version,
      generatedAt: isoTimestamp(analysis.generated_at),
      sourceUpdatedAt: isoTimestamp(source.updatedAt),
      fetchedAt: isoTimestamp(fetchedAt),
      stale: cache.stale === true,
      cached: cache.cached === true,
      analysisModel: typeof analysis.analysis_model === 'string' ? analysis.analysis_model : null,
      demo: analysis.demo === true,
    },
    posts,
    slides,
    assets,
    colors,
    tags,
    aiResults,
    dataQuality,
  };
}

export { safeHttpUrl };
