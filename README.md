# OHORA Nail Intelligence v4

A local-only React + Vite MVP for exploring the verified OHORA v3 analysis snapshot. The checked dataset contains 24 posts and 97 AI-analyzed image slides for the observed period 2026-10-02 through 2026-10-12.

## Requirements

- Node.js and npm compatible with Vite 7.
- A separately supplied, authorized OHORA v3 response snapshot at `data/private/step1-response.json`.

The snapshot is deliberately not included in this repository. Obtain it through the project's authorized data-handling process, create `data/private/`, and place the JSON at that exact path. The snapshot contains private post data and is excluded from Git. Do not put API credentials in the snapshot or commit any `.env*` file.

## Run locally

From PowerShell in the repository root:

```powershell
npm ci
New-Item -ItemType Directory -Force data/private
# Save the separately supplied snapshot as data/private/step1-response.json
npm run dev
```

Open `http://127.0.0.1:5173/`. The Vite development server exposes a loopback-only, GET-only `GET /api/ohora-dashboard` endpoint. It reads the private snapshot on the server, validates and normalizes it, then returns only the dashboard allowlist. It does not contact `dashboard2`, n8n, or an analysis API. Without the private snapshot, the app shows a local-data-unavailable state.

The browser receives the post fields used by the UI, exact-index matched slide URLs and tags, approved visual evidence, and aggregate data-quality summaries. Unmatched media URLs, the raw response envelope, credentials, and unrelated source fields are not returned. Matched source-image URLs are loaded by the browser to display analyzed posts.

## MVP status

Implemented and verified locally:

- Data-backed KPI cards, observed designs and combinations, color/tag analysis, and overview charts.
- Search, Asia/Seoul date filtering, post filters, sorting, and post detail modal.
- Five-sheet Excel export based on the current filtered result.
- Platform labeling based on validated Instagram permalink routes.
- Validation for exact carousel slide-index/image matching and data-quality issues.

The currently verified snapshot has 24 unique posts, 97 AI slides, 87 design-classified slides, 18 distinct design color labels, and 58 classified tag types. These are snapshot counts, not live or historical trend claims.

## Not implemented

- Production hosting/deployment, a production API adapter, authentication/authorization, and secret or credential provisioning.
- Live data refresh or a connection to `dashboard2`, n8n, or the source analysis workflow.
- Social Monitoring, Saved Collections, a notification feed, and user accounts.
- A historical comparison dataset for growth rates or previous-period KPIs.

Do not deploy this local development API as a production data service. Production use requires a separately reviewed backend, access-control, secret-management, and refresh design.

## Checks

```powershell
npm test
npm run verify:step2
npm run build
```

`npm run verify:step2` requires the private snapshot file. The build and unit tests do not publish the application or include the private snapshot.
