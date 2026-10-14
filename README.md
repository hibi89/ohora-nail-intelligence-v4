# OHORA Nail Intelligence v4

React + Vite dashboard for a verified OHORA v3 analysis snapshot. The coach-review URL opens without an access-code screen and exposes only an anonymized, data-minimized analysis view.

## Public data scope

The public `GET /api/ohora-dashboard` response contains anonymous observation labels, dates rounded to the Asia/Seoul calendar day, a verified platform label, AI design classifications, original AI slide indexes, and six AI tag dimensions. Dashboard KPIs and charts are calculated from those fields.

The public response and Excel export omit source post IDs, captions, original timestamps, permalinks, source image and asset URLs, visual evidence, likes, comments, follower counts, and per-post engagement rates. The four aggregate KPIs remain data-derived: 24 observations, 87 design-classified slides, 18 color labels, and 58 category-qualified tag types. Engagement is marked as not published.

The Vercel function reads the compressed snapshot from the server-only `OHORA_DASHBOARD_BR_BASE64` environment variable and applies the public allowlist before returning JSON. The original `data/private/step1-response.json` is excluded from Git and Vercel source uploads. The previously configured login-related Vercel secrets were not read or deleted; they are unused by the passwordless dashboard code.

This field reduction minimizes public source-content exposure. It does not establish a license for the underlying source material or AI-derived labels; confirm publication rights with the project owner before reusing the analysis elsewhere.

## Run locally

Requirements: Node.js 24 and npm compatible with Vite 7.

```powershell
npm ci
New-Item -ItemType Directory -Force data/private
# Save the separately supplied snapshot as data/private/step1-response.json
npm run dev
```

Open `http://127.0.0.1:5173/`. The Vite development server exposes a loopback-only, GET-only API which reads the private local snapshot. Local development keeps its complete validated fields; only the hosted Vercel route applies the public projection.

## Hosted deployment

The Vercel project uses the private GitHub repository `hibi89/ohora-nail-intelligence-v4`. Pushes to `main` trigger the linked Production deployment. The Vercel dashboard URL is public and does not require a password. Its server function does not connect to `dashboard2`, n8n, or an analysis API; it uses the existing server-side snapshot and does not refresh the data.

## Verified MVP features

- KPI cards, observed design combinations, colors and tag analysis.
- Search over public AI labels, Asia/Seoul date filters, design and AI-slide filters, and date sorting.
- Three Analysis Overview tabs, design and observation details, and five-sheet Excel export using the same filtered public data.
- Verified platform label without publishing the source permalink.
- Original AI slide indexes retained in anonymous observation order; original source images are not returned or exported.

Social Monitoring, Saved Collections, notifications, user accounts, live refresh, historical period comparisons, and source engagement metrics are not part of the public MVP.

## Checks

```powershell
npm test
npm run verify:step2
npm run build
```

`npm run verify:step2` requires the ignored local snapshot. Tests and the production build do not copy that private file into `dist/`.
