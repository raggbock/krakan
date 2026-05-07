# Performance session — 2026-05-02

All commits since `a1efaba` (first session commit) through `0dc606b`.

## Commits and expected impact

| SHA | Commit | Expected impact |
|-----|--------|----------------|
| `0af4429` | `perf(posthog): load session recorder from CDN` | ~538 KB removed from main bundle; session recording still functional |
| `43fae5f` | `perf(stripe): lazy-import Stripe SDK` | ~286 KB removed from shared bundle; Stripe only loaded on payment pages |
| `696b8d5` | `perf(supabase): use createBrowserClient from @supabase/ssr` | ~60 KB savings; also removes realtime subscription overhead on pages that don't need it |
| `e2e7138` | `perf(posthog): lazy-init session recording to unblock first paint` | Eliminates blocking PostHog init from critical path; first-paint unblocked |
| `8832ede` | `perf(takeover): disable Next prefetch for footer nav links` | Removes speculative prefetch of heavyweight `/takeover` route for every visitor |
| `d3a7190` | `perf(web): add ISR (1h revalidate) to /loppis and /kvartersloppis pages` | Market detail pages served from edge cache; eliminates DB round-trip per visitor |
| `4b5339c` | `perf(sitemap): parallelize independent data fetches` | Reduces sitemap generation time (build + on-demand revalidation) |
| `33573f2` | `perf(layout): preconnect to Supabase + PostHog origins` | Cuts ~100–200 ms connection setup from first API call; improves TTFB on cold sessions |
| `98712c2` | `feat(perf): track Web Vitals via PostHog` | Measurement only; enables ongoing LCP/CLS/INP/TTFB monitoring |
| `b8e6cfd` | `perf(edge): cache takeover-info results per token (5min TTL)` | Eliminates repeated DB reads for the same takeover token; edge function response time down |
| `5c86d8e` | `perf(icon): serve icon.svg as static asset with long cache` | Favicon served with immutable cache headers; 0 re-fetches on return visits |
| `d86afaa` | `perf(utforska): use direct /loppis/[slug] links` | Removes double-prefetch via 308 redirect; router prefetch resolves in one hop |
| `9361223` | `perf(web): add ISR to /arrangorer and /loppisar pages` | Organizer profiles and city listing pages served from edge cache; DB load reduced |
| `0dc606b` | `perf(web): convert <img> to next/image for LCP improvement` | Admin edit forms get AVIF/WebP for existing-image thumbnails; blob previews get lazy/async |

## Sentry baselines (pre-session)

From the bundle analysis doc (`bundle-analysis-2026-05-02.md`):

- Main bundle: ~884 KB (before lazy-loading Stripe + PostHog CDN)
- Estimated post-session: ~884 − 538 − 286 − 60 ≈ **~0 KB savings net** — actual savings depend on tree-shaking and what Sentry injects. Measure in Sentry after staging deploy.

Key Sentry metrics to watch:
- `web_vitals.lcp` on `/utforska`, `/loppis/[slug]`, `/`
- `web_vitals.ttfb` on ISR-cached routes (`/loppis`, `/kvartersloppis`, `/arrangorer`, `/loppisar`)
- `web_vitals.inp` on booking flow (Stripe lazy-load side-effect)

## Outstanding items not yet tackled

### Full static generation (`generateStaticParams`)
Routes like `/loppis/[slug]` revalidate every hour but are only pre-rendered at build time if `generateStaticParams` is exported. Without it, the first request after deploy is still SSR (cold). Adding `generateStaticParams` would make these truly static + ISR. Blocked on: deciding how many slugs to pre-render (all vs. top-N by traffic).

### Hydration cost reduction
The utforska page is a `'use client'` root that hydrates the entire market list client-side. Moving the static shell (hero, filters) to a Server Component and keeping only the dynamic list as a Client Component would reduce JS parse + hydration time. Estimated effort: medium (requires splitting the component).

### Route segment config for `/search`
`/search` is a client-only page; adding `export const dynamic = 'force-static'` with a static shell and deferring the search query to the client would let the initial HTML be edge-cached.

### Bundle splitting for admin routes
The admin import page pulls in heavy data-table dependencies that leak into the shared chunk. Lazy-importing those would reduce the shared bundle for public pages.

### `<Image>` on market cards (`/loppisar/[city]`)
The city listing page already uses `<Image fill>` for market thumbnails. No `priority` is set — the first card's image is a likely LCP candidate on mobile. Adding `priority` to `i === 0` would improve mobile LCP on city pages.

### Font subsetting
`Fraunces` (display font) is loaded as a full variable font. Subsetting to Latin + used weight axes would reduce font payload by ~30–50%.

## Verification plan

After the next staging deploy:

1. **Sentry Performance** — compare `web_vitals.lcp` P75 on `/utforska` and `/loppis/*` before vs. after. Target: LCP < 2.5 s.
2. **Sentry bundle size** — check the new JS bundle sizes in Sentry releases tab. Expect significant reduction on pages that previously loaded Stripe eagerly.
3. **PostHog → Insights** — create a Web Vitals trend chart using the `web_vitals_reported` events (added in `98712c2`). Break down by `metric_name` to see LCP/INP/CLS/TTFB separately.
4. **Edge cache hit rate** — check Cloudflare Workers analytics for cache-hit ratio on ISR routes. Expect high hit rate after first warm-up.
5. **takeover-info edge function** — check Supabase function logs for DB query count reduction after the 5-min cache (`b8e6cfd`).
6. **Prefetch audit** — use Chrome DevTools Network tab with "Slow 3G" throttle on `/utforska` to verify no stray prefetch waterfall to redirect targets.
