import { COMBINATION_CATEGORIES, TAG_CATEGORIES } from './ohoraTypes.js';

export const KPI_DEFINITIONS = Object.freeze({
  analyzedPosts: Object.freeze({
    label: 'Total Analyzed Posts',
    unit: 'posts',
    formula: 'Distinct post IDs with at least one AI slide result in the selected date range.',
  }),
  designSlides: Object.freeze({
    label: 'Trending Designs',
    unit: 'design slides',
    formula: 'Count of AI slides where is_design_post is true in the selected date range; this is volume, not growth.',
  }),
  activeColors: Object.freeze({
    label: 'Active Colors',
    unit: 'unique color labels',
    formula: 'Distinct color labels on design slides in the selected date range.',
  }),
  topTags: Object.freeze({
    label: 'Top Tags',
    unit: 'category-qualified tags',
    formula: 'Distinct (tag category, tag value) pairs across the six AI tag dimensions in the selected date range.',
  }),
});

export const ENGAGEMENT_DEFINITION = Object.freeze({
  perPost: '(likes + comments) / followers * 100; use the reported engagement field when present.',
  defaultAggregate: 'simple-mean-of-valid-post-rates',
  simpleMean: 'Arithmetic mean of non-null per-post engagement percentages; each post has equal weight.',
  weighted: 'Sum(likes + comments) / Sum(followers) * 100 over posts with all inputs present and followers > 0.',
  missing: 'Exclude missing values from the corresponding denominator and return sample counts; never coerce null to zero.',
});

export const DEFAULT_DISPLAY_TIME_ZONE = 'Asia/Seoul';

export function dateKeyInTimeZone(timestamp, timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const COMBINATION_DEFINITION = Object.freeze({
  categories: COMBINATION_CATEGORIES,
  minimumPopulatedCategories: 2,
  population: 'design slides only',
  donutDenominator: 'eligible design slides with at least two populated combination categories',
  donutDenominatorStatus: 'provisional-explicit-basis',
  other: 'All eligible combination slides outside the top five.',
});

const tagsForSlide = (slide) => TAG_CATEGORIES.flatMap((category) => slide.tags[category].map((value) => ({ category, value })));

/** Only show a platform when the permalink is a plausible secure Instagram post URL. */
export function verifiedPlatformFromPermalink(permalink) {
  if (typeof permalink !== 'string') return null;
  try {
    const url = new URL(permalink);
    const host = url.hostname.toLowerCase();
    const isInstagramHost = host === 'instagram.com' || host.endsWith('.instagram.com');
    const [route, shortcode] = url.pathname.split('/').filter(Boolean);
    if (url.protocol !== 'https:' || !isInstagramHost) return null;
    if (!['p', 'reel', 'tv', 'stories'].includes((route || '').toLowerCase())) return null;
    if (!shortcode || !/^[a-z\d._-]+$/i.test(shortcode)) return null;
    return 'Instagram';
  } catch {
    return null;
  }
}

function getSelectedPosts(model, dateRange, searchTerm = '', timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const search = searchTerm.trim().toLocaleLowerCase();
  return model.posts.filter((post) => {
    if (!post.publishedAt) return false;
    const date = dateKeyInTimeZone(post.publishedAt, timeZone);
    if (dateRange?.from && date < dateRange.from) return false;
    if (dateRange?.to && date > dateRange.to) return false;
    if (!search) return true;
    const relatedSlides = model.slides.filter((slide) => slide.postId === post.postId);
    const searchable = [post.caption || '', ...relatedSlides.flatMap((slide) => tagsForSlide(slide).map((tag) => tag.value))]
      .join('\n')
      .toLocaleLowerCase();
    return searchable.includes(search);
  }).sort((a, b) => {
    const byDate = (b.publishedAt || '').localeCompare(a.publishedAt || '');
    return byDate || a.postId.localeCompare(b.postId);
  });
}

function selectedSlides(model, selectedPosts) {
  const ids = new Set(selectedPosts.map((post) => post.postId));
  return model.slides.filter((slide) => ids.has(slide.postId));
}

function uniqueTags(slides, categories = TAG_CATEGORIES) {
  const result = new Map();
  for (const slide of slides) {
    for (const category of categories) {
      for (const value of slide.tags[category]) result.set(JSON.stringify([category, value]), { category, value });
    }
  }
  return [...result.values()];
}

function buildCombination(slide) {
  const groups = COMBINATION_CATEGORIES
    .map((category) => ({ category, tags: slide.tags[category] }))
    .filter((group) => group.tags.length > 0);
  if (groups.length < COMBINATION_DEFINITION.minimumPopulatedCategories) return null;
  const key = JSON.stringify(groups.map(({ category, tags }) => [category, tags]));
  const name = groups.map(({ tags }) => tags.join(' + ')).join(' · ');
  return { key, name, groups };
}

function buildCombinationStats(slides) {
  const designSlides = slides.filter((slide) => slide.isDesignPost === true);
  const grouped = new Map();
  let eligibleSlideCount = 0;
  for (const slide of designSlides) {
    const combination = buildCombination(slide);
    if (!combination) continue;
    eligibleSlideCount += 1;
    const existing = grouped.get(combination.key) || { ...combination, count: 0, slides: [] };
    existing.count += 1;
    existing.slides.push(slide);
    grouped.set(combination.key, existing);
  }
  const all = [...grouped.values()].sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    designSlideCount: designSlides.length,
    unclassifiedDesignSlideCount: designSlides.length - eligibleSlideCount,
    eligibleSlideCount,
    all,
  };
}

function buildTrendingDesigns(slides, limit = 5) {
  const stats = buildCombinationStats(slides);
  const representativeFor = (item) => item.slides
    .filter((slide) => slide.matchStatus.startsWith('matched') && slide.imageUrl)
    .slice()
    .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) || a.postId.localeCompare(b.postId))[0] || null;
  const imageFor = (representative) => representative ? {
    kind: 'analysis-source',
    postId: representative.postId,
    slideIndex: representative.index,
    assetId: representative.assetId,
    src: representative.imageUrl,
  } : null;
  const rankedCombinations = stats.all.map((item, index) => ({
    key: item.key,
    rank: index + 1,
    title: item.name,
    tags: item.groups.flatMap((group) => group.tags.map((value) => ({ category: group.category, value }))),
    observedSlideCount: item.count,
    support: { numerator: item.count, denominator: stats.eligibleSlideCount },
    representativeImage: imageFor(representativeFor(item)),
  }));
  const cards = stats.all.slice(0, limit).map((item) => {
    const representative = representativeFor(item);
    return {
      key: item.key,
      title: item.name,
      tags: item.groups.flatMap((group) => group.tags.map((value) => ({ category: group.category, value }))),
      observedSlideCount: item.count,
      support: { numerator: item.count, denominator: stats.eligibleSlideCount },
      representativeImage: imageFor(representative),
      periodGrowthPct: null,
    };
  });
  return {
    rankingBasis: 'design-slide-combination-frequency',
    labelSemantics: 'observed-frequency; not temporal growth',
    eligibleSlideCount: stats.eligibleSlideCount,
    unclassifiedDesignSlideCount: stats.unclassifiedDesignSlideCount,
    rankedCombinations,
    cards,
  };
}

function buildCombinationDistribution(slides, limit = 5) {
  const stats = buildCombinationStats(slides);
  const top = stats.all.slice(0, limit);
  const topCount = top.reduce((sum, item) => sum + item.count, 0);
  const denominator = stats.eligibleSlideCount;
  const slices = top.map((item) => ({
    key: item.key,
    label: item.name,
    count: item.count,
    denominator,
    percentage: denominator ? (item.count / denominator) * 100 : 0,
  }));
  const otherCount = Math.max(0, denominator - topCount);
  if (otherCount > 0) slices.push({
    key: 'other',
    label: 'Others',
    count: otherCount,
    denominator,
    percentage: denominator ? (otherCount / denominator) * 100 : 0,
  });
  return {
    basis: COMBINATION_DEFINITION.donutDenominator,
    basisStatus: COMBINATION_DEFINITION.donutDenominatorStatus,
    denominator,
    designSlideCount: stats.designSlideCount,
    unclassifiedDesignSlideCount: stats.unclassifiedDesignSlideCount,
    slices,
    totalCount: slices.reduce((sum, item) => sum + item.count, 0),
    percentageTotal: slices.reduce((sum, item) => sum + item.percentage, 0),
  };
}

function buildEngagement(posts) {
  const validReportedRates = posts.map((post) => post.engagementRatePct).filter((value) => value != null);
  const eligibleWeightedPosts = posts.filter((post) => post.likes != null && post.comments != null && post.followers > 0);
  const interactionTotal = eligibleWeightedPosts.reduce((sum, post) => sum + post.likes + post.comments, 0);
  const followerTotal = eligibleWeightedPosts.reduce((sum, post) => sum + post.followers, 0);
  return {
    defaultMethod: ENGAGEMENT_DEFINITION.defaultAggregate,
    simpleMeanPct: validReportedRates.length
      ? validReportedRates.reduce((sum, value) => sum + value, 0) / validReportedRates.length
      : null,
    simpleMeanSampleSize: validReportedRates.length,
    simpleMeanEligiblePostCount: posts.length,
    weightedPct: followerTotal ? (interactionTotal / followerTotal) * 100 : null,
    weightedNumerator: interactionTotal,
    weightedDenominator: followerTotal,
    weightedSampleSize: eligibleWeightedPosts.length,
    missingReportedRateCount: posts.length - validReportedRates.length,
  };
}

function buildPostRows(model, posts, slides) {
  const slidesByPost = new Map();
  for (const slide of slides) slidesByPost.set(slide.postId, [...(slidesByPost.get(slide.postId) || []), slide]);
  return posts.map((post) => {
    const postSlides = (slidesByPost.get(post.postId) || []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const representative = postSlides
      .filter((slide) => slide.matchStatus.startsWith('matched') && slide.imageUrl && slide.isDesignPost === true)
      .at(0)
      || postSlides.filter((slide) => slide.matchStatus.startsWith('matched') && slide.imageUrl).at(0)
      || null;
    const colors = [...new Set(postSlides.flatMap((slide) => slide.tags.color))];
    const tags = uniqueTags(postSlides, TAG_CATEGORIES.filter((category) => category !== 'color'));
    const platform = verifiedPlatformFromPermalink(post.permalink);
    return {
      postId: post.postId,
      publishedAt: post.publishedAt,
      explicitPlatform: post.explicitPlatform,
      platform,
      platformSource: platform ? 'validated-instagram-permalink' : null,
      thumbnail: representative ? {
        kind: 'analysis-source',
        postId: representative.postId,
        slideIndex: representative.index,
        assetId: representative.assetId,
        src: representative.imageUrl,
      } : null,
      thumbnailSlideIndex: representative?.index ?? null,
      caption: post.caption,
      keywords: tags,
      detectedColors: colors.map((value) => ({ label: value, swatchHex: null })),
      tags,
      isDesignPost: post.isDesignPost,
      likes: post.likes,
      comments: post.comments,
      shares: null,
      engagementRatePct: post.engagementRatePct,
      followers: post.followers,
      permalink: post.permalink,
      imageCount: post.imageCount,
      isCarousel: post.isCarousel,
      carouselChildCount: post.carouselChildCount,
      slideCount: postSlides.length,
      matchedSlideCount: postSlides.filter((slide) => slide.matchStatus.startsWith('matched')).length,
    };
  });
}

const TABLE_SORT_KEYS = new Set(['publishedAt', 'likes', 'comments', 'engagementRatePct']);

function sortPostRows(rows, requestedSort) {
  const sort = requestedSort && TABLE_SORT_KEYS.has(requestedSort.key)
    ? { key: requestedSort.key, direction: requestedSort.direction === 'asc' ? 'asc' : 'desc' }
    : { key: 'publishedAt', direction: 'desc' };
  const direction = sort.direction === 'asc' ? 1 : -1;
  const sortedRows = rows.slice().sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    if (left == null && right != null) return 1;
    if (right == null && left != null) return -1;
    if (left == null && right == null) return a.postId.localeCompare(b.postId);
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
    return comparison * direction || a.postId.localeCompare(b.postId);
  });
  return { rows: sortedRows, sort };
}

function dateRangeFor(model, requestedRange, timeZone) {
  if (requestedRange && (requestedRange.from || requestedRange.to)) {
    return { from: requestedRange.from || null, to: requestedRange.to || null, source: 'user-filter' };
  }
  const dates = model.posts.map((post) => post.publishedAt).filter(Boolean)
    .map((value) => dateKeyInTimeZone(value, timeZone)).filter(Boolean).sort();
  if (!dates.length) return { from: null, to: null, source: 'dataset-observed-range' };
  return { from: dates[0], to: dates.at(-1), source: 'dataset-observed-range' };
}

function buildOverview(slides, posts, dateRange, timeZone) {
  const byDate = new Map();
  const postById = new Map(posts.map((post) => [post.postId, post]));
  for (const post of posts) {
    if (!post.publishedAt) continue;
    const date = dateKeyInTimeZone(post.publishedAt, timeZone);
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, { date, postIds: [], tagMentionCount: 0, engagementRates: [] });
    const bucket = byDate.get(date);
    bucket.postIds.push(post.postId);
    if (post.engagementRatePct != null) bucket.engagementRates.push(post.engagementRatePct);
  }
  for (const slide of slides) {
    const post = postById.get(slide.postId);
    if (!post?.publishedAt) continue;
    const date = dateKeyInTimeZone(post.publishedAt, timeZone);
    const bucket = date ? byDate.get(date) : null;
    if (bucket) bucket.tagMentionCount += TAG_CATEGORIES.reduce((sum, category) => sum + slide.tags[category].length, 0);
  }
  const trendPoints = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((bucket) => ({
    date: bucket.date,
    postCount: bucket.postIds.length,
    tagMentionCount: bucket.tagMentionCount,
    tagMentionLabel: 'AI tag mentions',
    engagementMeanPct: bucket.engagementRates.length
      ? bucket.engagementRates.reduce((sum, value) => sum + value, 0) / bucket.engagementRates.length
      : null,
    engagementSampleSize: bucket.engagementRates.length,
    observed: true,
  }));

  const colorCounts = new Map();
  for (const slide of slides) {
    for (const color of slide.tags.color) colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
  }
  const colorDistribution = [...colorCounts.entries()].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  const tagCoverage = Object.fromEntries(TAG_CATEGORIES.map((category) => {
    const filledSlideCount = slides.filter((slide) => slide.tags[category].length > 0).length;
    const totalSlideCount = slides.length;
    return [category, {
      filledSlideCount,
      totalSlideCount,
      coverageRate: totalSlideCount ? filledSlideCount / totalSlideCount : 0,
      emptySlideCount: totalSlideCount - filledSlideCount,
    }];
  }));

  return {
    tabs: [
      { id: 'trend-analysis', label: 'Trend Analysis' },
      { id: 'color-distribution', label: 'Color Distribution' },
      { id: 'tag-coverage', label: 'Tag Coverage' },
    ],
    defaultTab: 'trend-analysis',
    dateRange,
    trend: {
      points: trendPoints,
      series: [
        { key: 'tagMentionCount', label: 'AI tag mentions', unit: 'tag occurrences' },
        { key: 'engagementMeanPct', label: 'Mean post engagement', unit: '%' },
      ],
      fillsUnobservedDatesWithZero: false,
    },
    colorDistribution,
    tagCoverage,
  };
}

/**
 * Build all dashboard-ready blocks from the canonical model. Date boundaries
 * are inclusive calendar dates in the configured display timezone.
 *
 * @param {import('./ohoraTypes.js').NormalizedOhoraData} model
 * @param {{dateRange?:{from?:string|null,to?:string|null},search?:string,timeZone?:string,selectedSidebarItem?:string,selectedOverviewTab?:string,tableSort?:{key:string,direction:string}}} [options]
 */
export function buildDashboardViewModel(model, options = {}) {
  const timeZone = options.timeZone || DEFAULT_DISPLAY_TIME_ZONE;
  const dateRange = dateRangeFor(model, options.dateRange, timeZone);
  const selectedPosts = getSelectedPosts(model, dateRange, options.search || '', timeZone);
  const slides = selectedSlides(model, selectedPosts);
  const designSlides = slides.filter((slide) => slide.isDesignPost === true);
  const colors = new Set(designSlides.flatMap((slide) => slide.tags.color));
  const fieldQualifiedTags = uniqueTags(slides);
  const combinations = buildCombinationStats(slides);
  const engagement = buildEngagement(selectedPosts);
  const trendingDesigns = buildTrendingDesigns(slides, 5);
  const combinationTrends = buildCombinationDistribution(slides, 5);
  const table = sortPostRows(buildPostRows(model, selectedPosts, slides), options.tableSort);
  const postsTable = table.rows;
  const insightCombination = combinations.all[0] || null;
  const analysisOverview = buildOverview(slides, selectedPosts, dateRange, timeZone);
  if (analysisOverview.tabs.some((tab) => tab.id === options.selectedOverviewTab)) {
    analysisOverview.activeTab = options.selectedOverviewTab;
  } else {
    analysisOverview.activeTab = analysisOverview.defaultTab;
  }
  const extraWarnings = combinationTrends.basisStatus !== 'approved'
    ? [{ code: 'combination-denominator-provisional', severity: 'warning', count: 1 }]
    : [];
  const warningsByCode = new Map();
  for (const warning of [...model.dataQuality.warnings, ...extraWarnings]) {
    const existing = warningsByCode.get(warning.code);
    if (existing) existing.count = Math.max(existing.count, warning.count);
    else warningsByCode.set(warning.code, { ...warning });
  }
  const warnings = [...warningsByCode.values()];
  const errors = model.dataQuality.errors;

  return {
    meta: model.meta,
    sidebar: {
      selectedItem: ['dashboard', 'trend-analysis', 'design-analysis', 'color-analysis', 'tag-analysis', 'social-monitoring', 'saved-collections'].includes(options.selectedSidebarItem)
        ? options.selectedSidebarItem
        : 'dashboard',
      menu: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'trend-analysis', label: 'Trend Analysis' },
        { id: 'design-analysis', label: 'Design Analysis' },
        { id: 'color-analysis', label: 'Color Analysis' },
        { id: 'tag-analysis', label: 'Tag Analysis' },
        { id: 'social-monitoring', label: 'Social Monitoring' },
        { id: 'saved-collections', label: 'Saved Collections' },
      ],
      storyImageSlot: 'sidebarStoryImage',
    },
    hero: {
      brand: 'OHORA',
      title: 'Nail Intelligence',
      subtitle: 'Discover trends. Analyze designs. Turn inspiration into opportunity.',
      decorativeImageSlot: 'heroBannerImage',
      dateRange,
      insight: {
        title: "Today's Insight",
        decorativeImageSlot: 'todayInsightImage',
        status: insightCombination ? 'candidate-needs-copy-approval' : 'no-supported-candidate',
        narrative: null,
        candidate: insightCombination ? {
          type: 'most-observed-design-combination',
          label: insightCombination.name,
          count: insightCombination.count,
          denominator: combinations.eligibleSlideCount,
        } : null,
      },
    },
    filters: {
      search: options.search || '',
      dateRange,
      dateBasis: `${timeZone} calendar dates; inclusive endpoints`,
      timeZone,
      defaultRangeBasis: 'full-observed-dataset-range',
    },
    kpis: [
      { id: 'analyzed-posts', label: KPI_DEFINITIONS.analyzedPosts.label, value: new Set(slides.map((slide) => slide.postId)).size, unit: KPI_DEFINITIONS.analyzedPosts.unit, definition: KPI_DEFINITIONS.analyzedPosts.formula, comparison: null },
      { id: 'design-slides', label: KPI_DEFINITIONS.designSlides.label, value: designSlides.length, unit: KPI_DEFINITIONS.designSlides.unit, definition: KPI_DEFINITIONS.designSlides.formula, comparison: null },
      { id: 'active-colors', label: KPI_DEFINITIONS.activeColors.label, value: colors.size, unit: KPI_DEFINITIONS.activeColors.unit, definition: KPI_DEFINITIONS.activeColors.formula, comparison: null },
      { id: 'top-tags', label: KPI_DEFINITIONS.topTags.label, value: fieldQualifiedTags.length, unit: KPI_DEFINITIONS.topTags.unit, definition: KPI_DEFINITIONS.topTags.formula, comparison: null },
    ],
    engagement,
    trendingDesigns,
    combinationTrends: {
      ...combinationTrends,
      decorativeImageSlot: 'signatureCombinationImage',
    },
    postsTable: {
      sort: table.sort,
      rows: postsTable,
      totalRows: postsTable.length,
      availableColumns: ['publishedAt', 'platform', 'thumbnail', 'caption', 'detectedColors', 'tags', 'likes', 'comments', 'engagementRatePct', 'permalink'],
      unavailableColumns: ['shares'],
    },
    analysisOverview,
    dataQuality: model.dataQuality,
    dataState: { status: errors.length ? 'blocked' : warnings.length ? 'degraded' : 'ready', ready: errors.length === 0, blockingErrorCount: errors.length },
    warnings,
  };
}

export { buildCombination, buildCombinationDistribution, buildEngagement, getSelectedPosts };
