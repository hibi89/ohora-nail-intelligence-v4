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
    `Search: ${search || '(none)'} | Date: ${range.from || 'open'} to ${range.to || 'open'} | Design posts only: ${tableFilters.designOnly ? 'Yes' : 'No'} | AI slide analysis only: ${tableFilters.analysisOnly ? 'Yes' : 'No'} | Sort: ${filters.tableSort?.key || 'publishedAt'} ${filters.tableSort?.direction || 'desc'}`,
    'Selection checkboxes do not limit exports. Every sheet uses the same filtered observation set; AI slide rows retain their original index order.',
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
    ['Publication scope', 'Source-level content and engagement', 'Omitted', '', '', '', '', 'Public exports contain anonymous dates, AI labels, and aggregate calculations only.'],
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
      post.recordLabel || 'Anonymous observation',
      dateKeyInTimeZone(post.publishedAt, 'Asia/Seoul') || '',
      row?.platform || '',
      displayBoolean(post.isDesignPost),
      slideCountByPost.get(post.postId) || 0,
    ];
  });
}

function imageRows(slides, posts) {
  const labels = new Map(posts.map((post) => [post.postId, post.recordLabel || 'Anonymous observation']));
  return slides.map((slide) => [
    labels.get(slide.postId) || 'Unlinked analysis record',
    countValue(slide.index),
    displayBoolean(slide.isDesignPost),
    ...Object.keys(CATEGORY_HEADERS).map((category) => (slide.tags?.[category] || []).join('; ')),
  ]);
}

function carouselRows(posts, slides) {
  const byPost = new Map();
  for (const slide of slides) byPost.set(slide.postId, [...(byPost.get(slide.postId) || []), slide]);
  return posts.filter((post) => (byPost.get(post.postId) || []).length > 1).map((post) => {
    const ordered = (byPost.get(post.postId) || []).slice().sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));
    return [
      post.recordLabel || 'Anonymous observation',
      dateKeyInTimeZone(post.publishedAt, 'Asia/Seoul') || '',
      ordered.length,
      ordered.map((slide) => slide.index ?? '').join(' → '),
    ];
  });
}

function qualityRows(snapshot, posts, slides, view, originalPostCount) {
  const rows = [
    ['Filtered scope', 'Anonymous observations in current export', posts.length, originalPostCount, 'Table filters applied after global search and date filters.'],
    ['Filtered scope', 'AI slide rows in current export', slides.length, snapshot.slides.length, 'Every selected post contributes all of its AI slide records.'],
    ['Filtered scope', 'Design-classified slide rows', slides.filter((slide) => slide.isDesignPost === true).length, slides.length, 'Slide-level AI classification.'],
    ['Publication scope', 'Matched Instagram images in dashboard', slides.filter((slide) => Boolean(slide.imageUrl)).length, slides.length, 'Displayed in the dashboard only; image URLs and image bytes are not included in the workbook.'],
    ['Publication scope', 'Original IDs, captions, direct post links, visual evidence', 'Omitted', '', 'These source-level fields are not included in the public export.'],
    ['Publication scope', 'Likes, comments, followers, engagement rates', 'Omitted', '', 'Per-post source metrics are not included in the public export.'],
    ['Filtered scope', 'Observations with a verified platform label', posts.filter((post) => view.postsTable.rows.find((row) => row.postId === post.postId)?.platform === 'Instagram').length, posts.length, 'Only the platform label is retained; the source URL is omitted.'],
    ['Metric basis', 'Combination eligible denominator', view.combinationTrends.denominator, view.combinationTrends.designSlideCount, 'Design slides with at least two populated dimensions among color, technique, and motif.'],
    ['Metric basis', 'Design slides excluded from combinations', view.combinationTrends.unclassifiedDesignSlideCount, view.combinationTrends.designSlideCount, 'Insufficient combination dimensions; excluded from the donut denominator.'],
  ];
  const issueLists = [
    ...(snapshot.dataQuality?.errors || []).map((issue) => ['Snapshot quality error', issue.code, issue.count, '', issue.message]),
    ...(snapshot.dataQuality?.warnings || []).map((issue) => ['Snapshot quality warning', issue.code, issue.count, '', issue.message]),
  ];
  return [...rows, ...issueLists];
}

const SHEET_DEFINITIONS = [
  { name: EXCEL_SHEETS[0], headers: ['Section', 'Metric / combination', 'Value / count', 'Numerator', 'Denominator', 'Share (%)', 'Sample size', 'Definition / notes'] },
  { name: EXCEL_SHEETS[1], headers: ['Anonymous observation', 'Published date (Asia/Seoul)', 'Verified platform label', 'AI design classification', 'AI slide count'] },
  { name: EXCEL_SHEETS[2], headers: ['Anonymous observation', 'Original AI slide index', 'AI design classification', ...Object.values(CATEGORY_HEADERS)] },
  { name: EXCEL_SHEETS[3], headers: ['Anonymous observation', 'Published date (Asia/Seoul)', 'AI slide count', 'Original AI slide order'] },
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
    imageRows(slides, posts),
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
