export class DashboardRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DashboardRequestError';
    this.code = code;
  }
}

export async function fetchDashboardData(signal) {
  let response;
  try {
    response = await fetch('/api/ohora-dashboard', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch {
    throw new DashboardRequestError('local-api-unreachable', 'The local data service could not be reached.');
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new DashboardRequestError('invalid-response', 'The local data service returned an unreadable response.');
  }

  if (!response.ok) {
    throw new DashboardRequestError(
      body?.error?.code || 'local-api-error',
      body?.error?.message || 'The local analysis data could not be loaded.',
    );
  }
  if (!body?.data || !Array.isArray(body.data.posts) || !Array.isArray(body.data.slides)) {
    throw new DashboardRequestError('invalid-contract', 'The local data service returned an unsupported dashboard contract.');
  }
  return body.data;
}
