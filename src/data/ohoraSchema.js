export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(['OHORA_V3_DATA_FIRST']);

export class DataContractError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'DataContractError';
    this.code = code;
  }
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate the response envelope without returning source values in an error.
 *
 * @param {unknown} response
 * @returns {{analysis:Record<string, any>, source:Record<string, any>, cache:Record<string, any>, fetchedAt:string|null, warnings:Array<{code:string,message:string}>}}
 */
export function validateOhoraResponse(response) {
  if (!isRecord(response) || !isRecord(response.data)) {
    throw new DataContractError('invalid-envelope', 'Expected an object with a data envelope.');
  }

  const analysis = response.data.analysis;
  if (!isRecord(analysis)) {
    throw new DataContractError('missing-analysis', 'The response does not contain an analysis object.');
  }
  if (typeof analysis.schema_version !== 'string' || !SUPPORTED_SCHEMA_VERSIONS.includes(analysis.schema_version)) {
    throw new DataContractError('unsupported-schema', 'The analysis schema version is missing or unsupported.');
  }
  if (!Array.isArray(analysis.observations)) {
    throw new DataContractError('missing-observations', 'The analysis observations field must be an array.');
  }

  const warnings = [];
  if (analysis.generated_at == null || !Number.isFinite(Date.parse(analysis.generated_at))) {
    warnings.push({ code: 'invalid-generated-at', message: 'The analysis generation time is not parseable.' });
  }
  if (response.cache?.stale === true) {
    warnings.push({ code: 'stale-response', message: 'The response is marked as stale by the source proxy.' });
  }
  if (analysis.demo === true) {
    warnings.push({ code: 'demo-data', message: 'The source marks this analysis as demo data.' });
  }
  if (Array.isArray(analysis.aiWarnings) && analysis.aiWarnings.length > 0) {
    warnings.push({ code: 'source-ai-warnings', message: 'The source analysis contains AI warnings.' });
  }
  if (Array.isArray(analysis.problems) && analysis.problems.length > 0) {
    warnings.push({ code: 'source-analysis-problems', message: 'The source analysis contains problem records.' });
  }

  return {
    analysis,
    source: isRecord(response.data.source) ? response.data.source : {},
    cache: isRecord(response.cache) ? response.cache : {},
    fetchedAt: typeof response.data.fetchedAt === 'string' ? response.data.fetchedAt : null,
    warnings,
  };
}
