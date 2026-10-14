# OHORA v4 — Passwordless Public Data Scope

## Decision

The coach-review dashboard is served without an application login. No public-use license or approval record for individual OHORA source posts was found in the project documents. The passwordless endpoint therefore uses a smaller, server-generated allowlist.

This is a technical minimization measure. It is not a legal determination that the original posts or derived AI labels are licensed for public reuse.

## Anonymous API and Excel fields

- Anonymous observation labels, not source post IDs.
- Publication date rounded to an Asia/Seoul calendar day.
- A verified `Instagram` platform label only; no source permalink.
- Post-level AI design classification.
- AI slide index, slide-level design classification, and six AI tag dimensions.
- Aggregate counts used for the observed KPIs, design rankings, color distribution, combination chart, and tag-coverage chart.

The verified KPI values remain computed from the source snapshot: 24 observations, 87 design-classified slides, 18 distinct color labels, and 58 category-qualified tag types.

## Excluded from public response and workbook

- Original post IDs and asset IDs.
- Captions and exact source timestamps.
- Post permalinks and source image URLs.
- Visual-evidence descriptions and other source text.
- Likes, comments, followers, and per-post engagement rates.
- Original source carousel/image counts. The public Carousel worksheet describes multi-slide AI analysis groups and preserves AI slide index order only.

The public UI marks engagement as not published. Trending cards and detail dialogs retain their layout and AI-tag content while source images and captions are omitted.

## Hosting boundary

- The public `GET /api/ohora-dashboard` route returns the minimized projection with `Cache-Control: no-store`.
- `OHORA_DASHBOARD_BR_BASE64` stays a server-only Vercel environment variable. The function transforms it before responding.
- The original JSON remains under `data/private/`, excluded from Git and Vercel source uploads.
- Existing `OHORA_PASSWORD_HASH` and `OHORA_SESSION_SECRET` environment variables were not read or deleted. The dashboard no longer requires or calls the login endpoint.
- This change does not access or modify `dashboard2`, n8n, or the database.

## Remaining publication limitation

The endpoint still exposes day-level dates, AI classifications, and tag labels derived from the source set. They could be correlated with public posts by someone who already knows the source account. If those derived fields are not cleared for public display, the correct alternative is to keep the dashboard protected or publish a separately approved aggregate-only dataset.
