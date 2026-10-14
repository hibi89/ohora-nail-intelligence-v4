import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { createFilteredWorkbook, EXCEL_SHEETS, filteredFilename } from '../src/export/excelExport.js';
import { normalizeOhoraV3 } from '../src/data/normalizeOhoraV3.js';
import { buildDashboardViewModel } from '../src/data/selectors.js';
import { toDashboardPayload } from '../server/localSnapshotApi.js';
import { toPublicDashboardPayload } from '../server/publicDashboard.js';

const snapshotPath = new URL('../data/private/step1-response.json', import.meta.url);
const hasSnapshot = existsSync(snapshotPath);

function readSnapshot() {
  const raw = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  return toPublicDashboardPayload(toDashboardPayload(normalizeOhoraV3(raw)));
}

function exportRowsFor(snapshot, options = {}) {
  const view = buildDashboardViewModel(snapshot, options);
  const filters = options.tableFilters || { designOnly: false, analysisOnly: false };
  return view.postsTable.rows.filter((row) => (!filters.designOnly || row.isDesignPost === true)
    && (!filters.analysisOnly || row.slideCount > 0));
}

function roundTrip(workbook) {
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  return XLSX.read(bytes, { type: 'array' });
}

test('filtered Excel export has the five approved sheets and exact filtered post/slide rows', { skip: !hasSnapshot }, () => {
  const snapshot = readSnapshot();
  const dateRange = buildDashboardViewModel(snapshot).filters.dateRange;
  const filters = {
    search: '',
    dateRange,
    tableSort: { key: 'publishedAt', direction: 'desc' },
    tableFilters: { designOnly: true, analysisOnly: true },
  };
  const rows = exportRowsFor(snapshot, filters);
  const exported = roundTrip(createFilteredWorkbook({ snapshot, rows, filters }));
  assert.deepEqual(exported.SheetNames, EXCEL_SHEETS);

  const table = (name) => XLSX.utils.sheet_to_json(exported.Sheets[name], { header: 1, defval: '' });
  const posts = table('게시물');
  const images = table('이미지');
  const carousels = table('캐러셀');
  assert.equal(posts[3].length, 5);
  assert.equal(posts.length - 4, rows.length);
  assert.equal(images.length - 4, snapshot.slides.filter((slide) => rows.some((row) => row.postId === slide.postId)).length);
  assert.deepEqual(images[3].slice(3, 9), ['Color', 'Technique', 'Texture', 'Motif', 'Season', 'Use']);
  assert.ok(rows.every((row, index) => posts[index + 4][0] === row.recordLabel));
  for (const row of carousels.slice(4)) {
    const indexes = String(row[3]).split(' → ').filter(Boolean).map(Number);
    assert.deepEqual(indexes, indexes.slice().sort((a, b) => a - b));
  }
  for (const name of exported.SheetNames) {
    for (const [address, cell] of Object.entries(exported.Sheets[name])) {
      if (!address.startsWith('!')) assert.equal(cell.f, undefined, `${name}!${address} must remain a literal value`);
    }
  }
  const quality = table('분석 품질');
  const publicScopeRow = quality.find((row) => row[1] === 'Original IDs, captions, images, links, visual evidence');
  assert.equal(publicScopeRow[2], 'Omitted');
  assert.equal(posts[3].some((header) => /caption|permalink|likes|followers|engagement/i.test(header)), false);
  assert.equal(images[3].some((header) => /asset|url|evidence/i.test(header)), false);
});

test('empty filters still produce all five header-only worksheets and a safe filename', { skip: !hasSnapshot }, () => {
  const snapshot = readSnapshot();
  const workbook = roundTrip(createFilteredWorkbook({
    snapshot,
    rows: [],
    filters: { search: 'no match', dateRange: { from: '2026-10-02', to: '2026-10-02' }, tableFilters: { designOnly: true, analysisOnly: true } },
  }));
  assert.deepEqual(workbook.SheetNames, EXCEL_SHEETS);
  for (const name of ['게시물', '이미지', '캐러셀']) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
    assert.ok(rows[3].length > 0);
    assert.equal(rows.length, 4);
  }
  const insights = XLSX.utils.sheet_to_json(workbook.Sheets['디자인 인사이트'], { header: 1, defval: '' });
  assert.equal(insights[4][2], 0);
  const quality = XLSX.utils.sheet_to_json(workbook.Sheets['분석 품질'], { header: 1, defval: '' });
  assert.equal(quality[4][2], 0);
  assert.equal(filteredFilename([]), 'OHORA_Nail_Intelligence_no-matching-posts.xlsx');
});

test('public workbook does not include source captions or original identifiers', { skip: !hasSnapshot }, () => {
  const snapshot = readSnapshot();
  const rows = buildDashboardViewModel(snapshot).postsTable.rows;
  const workbook = roundTrip(createFilteredWorkbook({ snapshot, rows, filters: { search: '', tableSort: { key: 'publishedAt', direction: 'desc' } } }));
  const posts = XLSX.utils.sheet_to_json(workbook.Sheets['게시물'], { header: 1, defval: '' });
  assert.equal(posts[3].includes('Instagram permalink'), false);
  assert.equal(posts[3].includes('Caption'), false);
  assert.equal(posts[3].includes('Post ID'), false);
  assert.match(posts[4][0], /^Observation \d{3}$/);
});

test('invalid export inputs fail closed before workbook creation', () => {
  assert.throws(() => createFilteredWorkbook({ snapshot: null, rows: [], filters: {} }), TypeError);
});
