# Bundle Analysis — 2026-05-02

**Tool:** `@next/bundle-analyzer` v16.2.4 (`ANALYZE=true next build`)
**Build:** Turbopack (Next.js 16.2.2, Cloudflare Workers target)
**Source:** `.next/diagnostics/route-bundle-stats.json` + chunk file inspection

---

## First-load JS by route (uncompressed)

| Route | First-load JS |
|---|---|
| `/loppis/[slug]` | 1,751 KB |
| `/fleamarkets/[id]/edit` | 1,729 KB |
| `/profile/create-market` | 1,721 KB |
| `/takeover/[token]` | **1,703 KB** |
| `/` (homepage) | **1,668 KB** |
| `/fragor-svar` | 1,668 KB |

All routes share the same 1,630 KB base (see below). Per-page deltas are 30–80 KB.

---

## Shared chunks (present on every route)

These load on **both `/` and `/takeover/[token]`** — reducing any one of them helps all pages.

| Chunk | Size | Library |
|---|---|---|
| `0l7tpix_qg6q7.js` | **538 KB** | PostHog `posthog-js` (rrweb session recording bundle) + Sentry |
| `0.kqklewswtlt.js` | **286 KB** | `@stripe/stripe-js` |
| `0-mv98clewm6q.js` | **226 KB** | `@supabase/supabase-js` (GoTrueClient + realtime) |
| `14kh5xxtocvhw.js` | **175 KB** | PostHog (secondary chunk) + Sentry tunnel shim |
| `10osc3y1wt4th.js` | **137 KB** | Next.js App Router internals (RSC flight decoder, PPR runtime) |
| `03~yq9q893hmn.js` | **110 KB** | React 19 runtime (core reconciler) |
| `0n1sksdd.0-24.js` | **56 KB** | Sentry browser SDK |
| `0hbf12w1bnftu.js` | **52 KB** | Next.js navigation / Link / router hooks |
| `11aktox4s2yzw.js` | **43 KB** | Next.js client-side router |
| `16raru29e5i-b.js` | **39 KB** | Next.js shared utilities |
| `12xyqknyi2.kf.js` | **34 KB** | Next.js App Router / route resolver |
| `0jcwx7e735ij8.js` | **27 KB** | Next.js Link prefetch logic |
| `0n1sksdd.0-24.js` | 56 KB | Sentry (listed above) |
| `turbopack-0h169ql-i~weg.js` | 11 KB | Turbopack runtime |

**Total shared baseline: ~1,630 KB uncompressed.** With Brotli at ratio ~4:1, this is ~400 KB over wire — still large.

---

## Top 5 fat dependencies (by contribution to shared bundle)

1. **PostHog `posthog-js` — ~713 KB total** (chunks `0l7tpix_qg6q7` 538 KB + `14kh5xxtocvhw` 175 KB)
   - Dominated by rrweb (session recording). The rrweb DOM snapshot + mutation observer code is ~400 KB of the 538 KB chunk.
   - Fix applied (2026-05-02): `disable_session_recording: true` at init + lazy `startSessionRecording()` via `requestIdleCallback`. This defers the recording *start* but the rrweb bundle still loads eagerly because `posthog-js` bundles it statically.
   - **Next step:** Use `posthog-js/dist/recorder` dynamic import, or set `session_recording: { maskAllText: false }` with CDN chunk loading instead of bundled rrweb.

2. **`@stripe/stripe-js` — ~286 KB** (chunk `0.kqklewswtlt.js`)
   - Loaded on **every** page including `/` and `/takeover/[token]`, which neither uses Stripe directly.
   - **Next step:** Move `loadStripe()` / `<Elements>` to only the booking flow pages (`/kvartersloppis/[slug]/ansok`, `/kvartersloppis/[slug]/ansokt`). Import `@stripe/stripe-js` only inside those components.

3. **`@supabase/supabase-js` — ~226 KB** (chunk `0-mv98clewm6q.js`)
   - Auth client is needed on every page (session management), so this is hard to eliminate from the base bundle.
   - However the realtime subscription module (~60 KB) is bundled even on pages that never use it.
   - **Next step:** Import `createClient` from `@supabase/supabase-js/dist/module/index.js` or switch to the lighter `@supabase/auth-js` for auth-only pages. Investigate whether the realtime module can be tree-shaken.

4. **Sentry — ~56 KB** (chunk `0n1sksdd.0-24.js`, plus portions of `14kh5xxtocvhw`)
   - Using `withSentryConfig` wraps all pages. The Sentry browser SDK is relatively compact but non-negligible.
   - **Next step:** Already using `tunnelRoute` (good). No immediate action needed; tree-shaking is limited by Sentry's initialization model.

5. **Next.js App Router runtime — ~383 KB** (chunks `10osc3y1wt4th` 137 KB + `03~yq9q893hmn` React 110 KB + `0hbf12w1bnftu` 52 KB + `11aktox4s2yzw` 43 KB)
   - This is the React 19 + Next.js App Router baseline — not reducible without changing framework.

---

## Leaflet (already lazy-loaded)

`leaflet` + `react-leaflet` + `react-leaflet-cluster` (~188 KB combined in chunk `0wb-zu203nqrj.js`) do **not** appear in the first-load chunks of any route. They are already loaded lazily (likely via `dynamic(() => import(...), { ssr: false })` in the map component). No action needed.

---

## Recommended next steps (priority order)

| Priority | Action | Estimated saving |
|---|---|---|
| 1 | **Lazy-import PostHog rrweb** — use `posthog.loadToolbar()` pattern or PostHog's `loaded` callback to defer rrweb chunk. Consider setting `disable_session_recording: true` globally and only enabling for opted-in users. | ~400 KB (rrweb from shared bundle) |
| 2 | **Move `@stripe/stripe-js` to booking-flow only** — remove it from the global `AuthProvider` / `layout.tsx` import chain. Only import inside `<StripeElementsProvider>` which should be rendered solely on `/kvartersloppis/[slug]/ansok`. | ~286 KB off base bundle |
| 3 | **Audit `@supabase/supabase-js` imports** — check if realtime is actually needed; if not, use `createBrowserClient` from `@supabase/ssr` which excludes realtime by default. | ~60 KB off base bundle |
| 4 | **Per-page code splitting of auth-only components** — `Nav`, `AuthProvider`, `QueryProvider` load on every page including `/takeover/[token]` which doesn't use auth. A separate layout for the takeover route (without `AuthProvider`) could save ~80–100 KB on that flow. | ~100 KB off takeover |

---

## Build environment note

Build ran successfully on Windows 11 with Turbopack. The `@next/bundle-analyzer` HTML reports were not saved to disk (they open a browser window directly) — analysis above is based on `.next/diagnostics/route-bundle-stats.json` and direct chunk inspection via Node.js.
