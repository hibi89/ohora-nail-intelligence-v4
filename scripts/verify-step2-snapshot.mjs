import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeOhoraV3 } from '../src/data/normalizeOhoraV3.js';
import { buildDashboardViewModel } from '../src/data/selectors.js';
import { DECORATIVE_ASSETS } from '../src/config/decorativeAssets.js';

const snapshotPath = resolve(process.cwd(), 'data/private/step1-response.json');
let response;
try {
  response = JSON.parse(await readFile(snapshotPath, 'utf8'));
} catch {
  console.error('STEP 2 verification could not read the ignored local snapshot. No source values were printed.');
  process.exitCode = 2;
  process.exit();
}

const model = normalizeOhoraV3(response);
const view = buildDashboardViewModel(model);
const values = Object.fromEntries(view.kpis.map((item) => [item.id, item.value]));
const expected = {
  'analyzed-posts': 24,
  'design-slides': 87,
  'active-colors': 18,
  'top-tags': 58,
};
const kpiMatches = Object.entries(expected).every(([key, value]) => values[key] === value);
const decorativeAssets = Object.values(DECORATIVE_ASSETS);
const decorativeSlotsReady = decorativeAssets.filter((asset) => asset.status === 'ready' && asset.src).length;
const decorativeSlotsPending = decorativeAssets.filter((asset) => asset.status === 'pending-generation' || !asset.src).length;
const q = model.dataQuality.summary;
const result = {
  status: kpiMatches && q.matchSuccessCount === 97 && q.matchFailureCount === 0 && decorativeSlotsReady === 4 ? 'pass' : 'fail',
  schemaVersion: model.meta.schemaVersion,
  kpis: values,
  dataQuality: {
    posts: q.postCount,
    uniquePostIds: q.uniquePostIdCount,
    slides: q.slideCount,
    imageAssets: q.imageAssetCount,
    matchSuccess: q.matchSuccessCount,
    slideMatchFailures: q.matchFailureCount,
    unmatchedAssets: q.unmatchedAssetCount,
    designSlides: q.designSlideCount,
    nonDesignSlides: q.nonDesignSlideCount,
    warningCount: model.dataQuality.warnings.length,
    errorCount: model.dataQuality.errors.length,
  },
  engagement: {
    defaultMethod: view.engagement.defaultMethod,
    simpleMeanPct: view.engagement.simpleMeanPct,
    simpleMeanSampleSize: view.engagement.simpleMeanSampleSize,
    weightedPct: view.engagement.weightedPct,
    weightedSampleSize: view.engagement.weightedSampleSize,
  },
  dateRangeDefault: view.filters.dateRange,
  decorativeSlotsReady,
  decorativeSlotsPending,
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
