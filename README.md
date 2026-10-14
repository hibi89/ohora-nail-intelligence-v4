# OHORA Nail Intelligence v4

React + Vite dashboard for the verified OHORA v3 analysis snapshot. The hosted dashboard keeps the reviewed UI and real snapshot data, while requiring a time-limited access code before the browser can request any analysis data.

## Data handling

- The original response at `data/private/step1-response.json` is deliberately excluded from Git and Vercel source uploads, and is not sent to Vercel.
- Production data is stored only as the already validated dashboard allowlist, Brotli-compressed and base64-encoded in the Vercel **Secret** environment variable `OHORA_DASHBOARD_BR_BASE64`. A Vercel Node.js function loads this allowlist only after session authentication. The raw response envelope and unrelated source fields are not deployed.
- `OHORA_PASSWORD_HASH` contains a salted scrypt verifier, not the access code. `OHORA_SESSION_SECRET` signs an eight-hour, HttpOnly, Secure, SameSite=Strict session cookie. Set all three as Secret Production environment variables; never put their values in Git, static assets, or browser variables.
- The authorized browser response contains the dashboard fields, matched post image URLs, captions, permalinks, metrics, and visual evidence that the existing UI uses. Do not share the access code beyond the intended reviewer.
- The deployment does not connect to `dashboard2`, n8n, or an analysis API. It uses the approved snapshot only; it does not refresh the data.

## Run locally

Requirements: Node.js and npm compatible with Vite 7.

```powershell
npm ci
New-Item -ItemType Directory -Force data/private
# Save the separately supplied, authorized snapshot as data/private/step1-response.json
npm run dev
```

Open `http://127.0.0.1:5173/`. The Vite development server exposes a loopback-only, GET-only `GET /api/ohora-dashboard` endpoint. It reads the local private snapshot on the server and returns the normalized dashboard allowlist. Without the local snapshot, the dashboard shows a data-unavailable state.

## Hosted deployment

The Vercel project uses the private GitHub repository `hibi89/ohora-nail-intelligence-v4`. Vercel's Node.js functions in `api/` provide the authenticated production API. Configure the three Sensitive Production environment variables above before promoting a production deployment. The access password is generated separately and its salted hash is configured as `OHORA_PASSWORD_HASH`; only the reviewer receives the password.

The hosted source does not contain the private JSON. `.vercelignore` excludes `data/private/`, `data/raw/`, `.env*`, and local build/test output as a second safeguard. The dashboard API is GET-only, sends `Cache-Control: private, no-store`, and exposes no unauthenticated data. Login requires a same-origin HTTPS POST.

## Verified MVP

- Data-backed KPI cards, observed designs and combinations, color/tag analysis, and overview charts.
- Search, Asia/Seoul date filtering, post filters, sorting, and post detail modal.
- Five-sheet Excel export based on the current filtered result.
- Platform labeling based on validated Instagram permalink routes.
- Exact carousel slide-index/image matching and data-quality reporting.

The reviewed snapshot contains 24 unique posts, 97 AI-analyzed image slides, 87 design-classified slides, 18 distinct design color labels, and 58 classified tag types. These are counts from the observed snapshot, not live or historical trend claims.

Social Monitoring, Saved Collections, notifications, user accounts, live refresh, and historical period comparisons are not implemented.

## Checks

```powershell
npm test
npm run verify:step2
npm run build
```

`npm run verify:step2` requires the private local snapshot. Unit tests and the production build do not publish or include that local file.
