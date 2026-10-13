import * as XLSX from 'xlsx';
import { buildDashboardViewModel } from '../data/buildDashboardViewModel.js';
import { dateKeyInTimeZone } from '../data/selectors.js';

export const EXCEL_SHEETS = Object.freeze([
  '디자인 인사이트',
  '게시물',
  '이미지',
  '캐러셀',
  '분석 품질',
]);

const CATEGORY_HEADERS = Object.freeze({
  color: 'Color',
  technique: 'Technique',
  texture: 'Texture',
  motif: 'Motif',
  season: 'Season',
  use: 'Use',
});

const safeText = (value) => typeof value === 'string' ? value : '';
const displayBoolean = (value) => value === true ? 'Yes' : value === false ? 'No' : 'Unknown';
const countValue = (value) => Number.isFinite(value) ? value : '';

function filterSummary(filters, timeZone, rowCount) {
  const range = filters.dateRange || {};
  const tableFilters = filters.tableFilters || {};
  const search = safeText(filters.search).replace(/[\r\n]+/g, ' ').slice(0, 160);
  return [
    `Filtered export · ${rowCount} posts · time zone ${timeZone}`,
    `Search: ${search || '(none)'} | Date: ${range.from || 'open'} to ${range.to || 'open'} | Design posts only: ${tableFilters.designOnly ? 'Yes' : 'No'} | Matched thumbnail only: ${tableFilters.imageOnly ? 'Yes' : 'No'} | Sort: ${filters.tableSort?.key || 'publishedAt'} ${filters.tableSort?.direction || 'desc'}`,
    'Selection checkboxes do not limit exports. Every sheet uses the same filtered post set; slide rows retain original carousel index order.',
  ];
}

function buildFilteredModel(snapshot, rows, timeZone, sort) {
  const postIds = new Set(rows.map((row) => row.postId));
  const filteredSnapshot = {
    ...snapshot,
    posts: snapshot.posts.filter((post) => postIds.has(post.postId)),
    slides: snapshot.slides.filter((slide) => postIds.has(slide.postId)),
  };
  const view = buildDashboardViewModel(filteredSnapshot, { timeZone, tableSort: sort });
  const orderedIds = new Map(rows.map((row, index) => [row.postId, index]));
  const posts = rows.map((row) => filteredSnapshot.posts.find((post) => post.postId === row.postId)).filter(Boolean);
  const slides = filteredSnapshot.slides.slice().sort((a, b) => {
    const postOrder = (orderedIds.get(a.postId) ?? Number.MAX_SAFE_INTEGER) - (orderedIds.get(b.postId) ?? Number.MAX_SAFE_INTEGER);
    return postOrder || (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER);
  });
  return { postIds, posts, slides, view, filteredSnapshot };
}

function insightRows(view) {
  const rows = [
    ['KPI', 'Analyzed posts', view.kpis.find((item) => item.id === 'analyzed-posts')?.value ?? 0, '', '', '', '', 'Unique selected post IDs.'],
    ['KPI', 'Observed design slides', view.kpis.find((item) => item.id === 'design-slides')?.value ?? 0, '', '', '', '', 'AI slides classified as design.'],
    ['KPI', 'Observed colors', view.kpis.find((item) => item.id === 'active-colors')?.value ?? 0, '', '', '', '', 'Distinct color labels on design slides.'],
    ['KPI', 'Classified tag types', view.kpis.find((item) => item.id === 'top-tags')?.value ?? 0, '', '', '', '', 'Distinct category-qualified tags across six dimensions.'],
    ['Engagement', 'Mean reported engagement rate (%)', view.engagement.simpleMeanPct ?? '', '', view.engagement.simpleMeanSampleSize, '', view.engagement.simpleMeanEligiblePostCount, 'Simple mean of non-null source per-post rates; not recomputed.'],
    ['Engagement', 'Weighted interactions / followers (%)', view.engagement.weightedPct ?? '', view.engagement.weightedNumerator, view.engagement.weightedDenominator, '', view.engagement.weightedSampleSize, 'Sum(likes + comments) / sum(followers) × 100 for eligible posts.'],
  ];
  for (const combination of view.trendingDesigns.rankedCombinations) {
    rows.push(['Trending design', combination.title, combination.observedSlideCount, combination.support.numerator, combination.support.denominator, combination.support.denominator ? combination.observedSlideCount / combination.support.denominator * 100 : '', '', 'Observed combination frequency among eligible design slides; not growth.']);
  }
  for (const slice of view.combinationTrends.slices) {
    rows.push(['Combination distribution', slice.label, slice.count, slice.count, slice.denominator, slice.percentage, '', 'Share of eligible slides with at least two populated color, technique, or motif dimensions.']);
  }
  return rows;
}

function postRows(posts, slides, rows) {
  const rowById = new Map(rows.map((row) => [row.postId, row]));
  const slideCountByPost = new Map();
  for (const slide of slides) slideCountByPost.set(slide.postId, (slideCountByPost.get(slide.postId) || 0) + 1);
  return posts.map((post) => {
    const row = rowById.get(post.postId);
    return [
      post.postId,
      dateKeyInTimeZone(post.publishedAt, 'Asia/Seoul') || '',
      post.publishedAt || '',
      row?.platform || '',
      post.permalink || '',
      safeText(post.caption),
      displayBoolean(post.isDesignPost),
      countValue(post.likes),
      countValue(post.comments),
      countValue(post.followers),
      countValue(post.engagementRatePct),
      countValue(post.imageCount),
      (slideCountByPost.get(post.postId) || 0),
    ];
  });
}

function imageRows(slides) {
  return slides.map((slide) => [
    slide.postId,
    countValue(slide.index),
    slide.assetId || '',
    slide.matchStatus || 'unknown',
    slide.imageUrl || '',
    displayBoolean(slide.isDesignPost),
    ...Object.keys(CATEGORY_HEADERS).map((category) => (slide.tags?.[category] || []).join('; ')),
    slide.visualEvidence ? JSON.stringify(slide.visualEvidence) : '',
  ]);
}

function carouselRows(posts, slides) {
  const byPost = new Map();
  for (const slide of slides) byPost.set(slide.postId, [...(byPost.get(slide.postId) || []), slide]);
  return posts.filter((post) => {
    const postSlides = byPost.get(post.postId) || [];
    return post.isCarousel === true || (post.imageCount ?? 0) > 1 || (post.carouselChildCount ?? 0) > 1 || postSlides.length > 1;
  }).map((post) => {
    const ordered = (byPost.get(post.postId) || []).slice().sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));
    return [
      post.postId,
      post.publishedAt || '',
      displayBoolean(post.isCarousel),
      countValue(post.imageCount),
      countValue(post.carouselChildCount),
      ordered.length,
      ordered.filter((slide) => slide.matchStatus?.startsWith('matched')).length,
      ordered.map((slide) => slide.index ?? '').join(' → '),
      ordered.map((slide) => slide.assetId || '').join(' | '),
      ordered.map((slide) => slide.matchStatus || 'unknown').join(' | '),
    ];
  });
}

function qualityRows(snapshot, posts, slides, view, originalPostCount) {
  const snapshotSummary = snapshot.dataQuality?.summary || {};
  const rows = [
    ['Filtered scope', 'Posts in current export', posts.length, originalPostCount, 'Post table filters applied after global search and date filters.'],
    ['Filtered scope', 'AI slide rows in current export', slides.length, snapshot.slides.length, 'Every selected post contributes all of its AI slide records.'],
    ['Filtered scope', 'Exact matched slide rows', slides.filter((slide) => slide.matchStatus === 'matched').length, slides.length, 'An exact post ID + slide index + URL match is required.'],
    ['Filtered scope', 'Design-classified slide rows', slides.filter((slide) => slide.isDesignPost === true).length, slides.length, 'Slide-level AI classification.'],
    ['Filtered scope', 'Posts with a verified Instagram permalink', posts.filter((post) => view.postsTable.rows.find((row) => row.postId === post.postId)?.platform === 'Instagram').length, posts.length, 'HTTPS URL on an Instagram host with a recognized post route.'],
    ['Completeness', 'Likes missing', posts.filter((post) => post.likes == null).length, posts.length, 'Blank values are preserved; no imputation.'],
    ['Completeness', 'Comments missing', posts.filter((post) => post.comments == null).length, posts.length, 'Blank values are preserved; no imputation.'],
    ['Completeness', 'Followers missing', posts.filter((post) => post.followers == null).length, posts.length, 'Blank values are preserved; no imputation.'],
    ['Completeness', 'Reported engagement rate missing', posts.filter((post) => post.engagementRatePct == null).length, posts.length, 'The source metric is kept distinct from the weighted calculation.'],
    ['Completeness', 'Explicit source platform field missing', posts.filter((post) => !post.explicitPlatform).length, posts.length, 'Displayed platform may still be derived from a verified permalink.'],
    ['Completeness', 'Shares missing / unavailable', posts.length, posts.length, 'Shares are not present in the approved data contract.'],
    ['Metric basis', 'Combination eligible denominator', view.combinationTrends.denominator, view.combinationTrends.designSlideCount, 'Design slides with at least two populated dimensions among color, technique, and motif.'],
    ['Metric basis', 'Design slides excluded from combinations', view.combinationTrends.unclassifiedDesignSlideCount, view.combinationTrends.designSlideCount, 'Insufficient combination dimensions; excluded from the donut denominator.'],
    ['Metric basis', 'Engagement reported-rate sample size', view.engagement.simpleMeanSampleSize, posts.length, 'Non-null source engagement rates included in the simple mean.'],
    ['Metric basis', 'Weighted engagement eligible post count', view.engagement.weightedSampleSize, posts.length, 'Requires likes, comments, and a positive follower count.'],
    ['Snapshot integrity (global)', 'Unmatched source image assets', countValue(snapshotSummary.unmatchedAssetCount), countValue(snapshotSummary.imageAssetCount), 'Global snapshot count. Unmatched source asset URLs are not included in the export.'],
  ];
  const issueLists = [
    ...(snapshot.dataQuality?.errors || []).map((issue) => ['Snapshot quality error', issue.code, issue.count, '', issue.message]),
    ...(snapshot.dataQuality?.warnings || []).map((issue) => ['Snapshot quality warning', issue.code, issue.count, '', issue.message]),
  ];
  return [...rows, ...issueLists];
}

const SHEET_DEFINITIONS = [
  { name: EXCEL_SHEETS[0], headers: ['Section', 'Metric / combination', 'Value / count', 'Numerator', 'Denominator', 'Share (%)', 'Sample size', 'Definition / notes'] },
  { name: EXCEL_SHEETS[1], headers: ['Post ID', 'Published date (Asia/Seoul)', 'Published timestamp (UTC)', 'Platform', 'Instagram permalink', 'Caption', 'Post is design', 'Likes', 'Comments', 'Followers', 'Reported engagement rate (%)', 'Source image count', 'AI slide count'] },
  { name: EXCEL_SHEETS[2], headers: ['Post ID', 'Original slide index', 'Matched image asset ID', 'Image match status', 'Matched image URL', 'Slide is design', ...Object.values(CATEGORY_HEADERS), 'Visual evidence (JSON)'] },
  { name: EXCEL_SHEETS[3], headers: ['Post ID', 'Published timestamp (UTC)', 'Source is carousel', 'Source image count', 'Carousel child count', 'AI slide count', 'Exactly matched slides', 'Original slide order', 'Matched asset IDs in slide order', 'Match statuses in slide order'] },
  { name: EXCEL_SHEETS[4], headers: ['Section', 'Check / metric', 'Observed', 'Denominator / snapshot reference', 'Definition / notes'] },
];

function worksheetFor(definition, rows, metadata) {
  const sheet = XLSX.utils.aoa_to_sheet([
    [metadata[0]],
    [metadata[1]],
    [metadata[2]],
    definition.headers,
    ...rows,
  ]);
  const finalColumn = XLSX.utils.encode_col(definition.headers.length - 1);
  const finalRow = Math.max(4, rows.length + 4);
  sheet['!autofilter'] = { ref: `A4:${finalColumn}${finalRow}` };
  return sheet;
}

export function createFilteredWorkbook({ snapshot, rows, filters, timeZone = 'Asia/Seoul' }) {
  if (!snapshot || !Array.isArray(snapshot.posts) || !Array.isArray(snapshot.slides) || !Array.isArray(rows)) {
    throw new TypeError('A validated dashboard snapshot and filtered post rows are required.');
  }
  const { posts, slides, view } = buildFilteredModel(snapshot, rows, timeZone, filters?.tableSort);
  const metadata = filterSummary(filters || {}, timeZone, posts.length);
  const allRows = [
    insightRows(view),
    postRows(posts, slides, rows),
    imageRows(slides),
    carouselRows(posts, slides),
    qualityRows(snapshot, posts, slides, view, snapshot.posts.length),
  ];
  const workbook = XLSX.utils.book_new();
  SHEET_DEFINITIONS.forEach((definition, index) => {
    XLSX.utils.book_append_sheet(workbook, worksheetFor(definition, allRows[index], metadata), definition.name);
  });
  workbook.Props = {
    Title: 'OHORA Nail Intelligence filtered analysis',
    Subject: `Filtered local analysis export · ${posts.length} posts`,
    Author: 'OHORA Nail Intelligence',
    CreatedDate: new Date(),
  };
  return workbook;
}

export function filteredFilename(rows, timeZone = 'Asia/Seoul') {
  const dates = rows.map((row) => dateKeyInTimeZone(row.publishedAt, timeZone)).filter(Boolean).sort();
  const rangeLabel = dates.length ? `${dates[0]}_to_${dates.at(-1)}` : 'no-matching-posts';
  return `OHORA_Nail_Intelligence_${rangeLabel}.xlsx`;
}

export async function downloadFilteredWorkbook(options) {
  const workbook = createFilteredWorkbook(options);
  const filename = filteredFilename(options.rows, options.timeZone || 'Asia/Seoul');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
  return { filename, postCount: options.rows.length, slideCount: options.snapshot.slides.filter((slide) => options.rows.some((row) => row.postId === slide.postId)).length };
}
