# Staging smoke test — kvartersloppis + perf release

**Staging URL:** https://fyndstigen-staging.sebastian-myrdahl.workers.dev
**Branch HEAD:** `8993342`
**Date:** 2026-05-02

This release includes the kvartersloppis MVP, route save-funnel fixes, perf
optimizations (ISR, edge caching, bundle slimming) and analytics. Use this
checklist in order. Tick boxes by editing or print/screen-capture as you go.

> **Note:** staging shares the production Supabase database. Don't create
> test data with real-looking organizer emails — they'll be visible to anyone
> hitting `fyndstigen.se` until cleaned up.

---

## 1. Smoke — anonymous visitor

Open in **incognito** to start fresh.

- [ ] Visit `/` (homepage) — loads under 3 s, no console errors
- [ ] Visit `/utforska` — markets render, clicking a card goes to `/loppis/[slug]` (NOT `/fleamarkets/[id]`)
- [ ] Visit `/map` — pins render, kvartersloppis pins are **lila** (if any kvartersloppis is published)
- [ ] Visit `/search` — search a city (e.g. `Örebro`); markets and any kvartersloppis show up; filter chips "Bara butiker" / "Bara kvartersloppis" work
- [ ] Visit `/loppisar/orebro` — markets list renders, "Kvartersloppisar i Örebro" section shows if any exist
- [ ] DevTools Network: `/icon.svg` loads in **<50 ms** (was 863 ms before)
- [ ] No 404s in Network for `_next/static/...` chunks
- [ ] PostHog session recording: NO `posthog.com/s/` POST visible until ~2 s after first paint (deferred via requestIdleCallback)

## 2. SEO + JSON-LD

- [ ] View source on `/loppis/<published-slug>` — confirm `<script type="application/ld+json">` blocks: LocalBusiness + BreadcrumbList + (optional) Event
- [ ] Same for `/kvartersloppis/<published-slug>` — TouristTrip + Event + BreadcrumbList
- [ ] Test one URL through [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] `/sitemap.xml` includes `/kvartersloppis/<slug>` URLs

## 3. Kvartersloppis flow — organizer

Login as a test organizer (NOT your real account if avoidable).

- [ ] Visit `/skapa/kvartersloppis` — form renders with all fields
- [ ] Submit invalid form (past date, end < start, close ≤ open) — inline error appears, no submit
- [ ] Submit valid form with `Publicera direkt = false` — redirects to `/kvartersloppis/<slug>/admin`
- [ ] Admin page shows: name, "0 ansökningar", queue is empty
- [ ] Verify event appears in DB:
  ```sql
  select id, slug, published_at, organizer_id from block_sales
  where created_at > now() - interval '5 min'
  order by created_at desc limit 5;
  ```
- [ ] Re-visit `/kvartersloppis/<slug>` as anon (incognito) — you should NOT see drafts (`published_at IS NULL` → 404). Switch back to organizer to confirm draft IS visible.
- [ ] Edit your draft (use the create form again? OR just publish) — either way, set `published_at` and verify the public URL becomes accessible.

## 4. Kvartersloppis flow — guest application (anonymous)

Open incognito, navigate to a published `/kvartersloppis/<slug>`.

- [ ] Click "Ansök om eget stånd" — `/kvartersloppis/<slug>/ansok` renders
- [ ] Submit with empty email — validation blocks
- [ ] Submit with description >200 chars — character counter goes red, blocks submit
- [ ] Fill valid form, submit — redirects to `/kvartersloppis/<slug>/ansokt`
- [ ] Check email inbox — confirmation email arrives within 1 minute
- [ ] Click the confirm link — should land somewhere indicating success (or redirect to event page)
- [ ] Verify in DB:
  ```sql
  select id, applicant_email, status, email_confirmed_at
  from block_sale_stands
  where created_at > now() - interval '5 min'
  order by created_at desc;
  ```
  `status` should now be `confirmed`.
- [ ] As organizer (refresh `/kvartersloppis/<slug>/admin`): pending stand visible in queue

## 5. Kvartersloppis — organizer decision

- [ ] Click "Godkänn" on the stand — status flips, applicant gets email
- [ ] Verify approval email arrives in test inbox; contains link to event page + edit link
- [ ] Click edit link — `/kvartersloppis/<slug>/min-ansokan?token=...` renders, lets you change description/street
- [ ] Edit description, save — DB row updates
- [ ] As anon: visit `/kvartersloppis/<slug>` — your approved stand pin appears on the map

## 6. Honeypot

This requires devtools.

- [ ] On `/kvartersloppis/<slug>/ansok` open DevTools → Elements
- [ ] Find the hidden `<input name="website">` (off-screen via `left-[-9999px]`, `tabIndex=-1`, `aria-hidden`)
- [ ] Type a value into it via `document.querySelector('input[name=website]').value = 'spam'`
- [ ] Fill the rest of the form normally and submit
- [ ] Expect: generic "Något gick fel" error, NO new row in `block_sale_stands`

Same on `/rundor/skapa` AnonSaveForm.

## 7. Route save — anonymous magic-link flow

Incognito, NOT logged in.

- [ ] Visit `/rundor/skapa`
- [ ] Add 2-3 markets to a route
- [ ] See the "Du har N stopp på din runda — spara den så du inte tappar bort den" CTA
- [ ] Submit anon-save form with a test email
- [ ] Get redirected to `/rundor/skapa/tack`
- [ ] Email arrives with magic link
- [ ] Click magic link — auto-signs you in, route is saved with `created_by = your-new-user-id`
- [ ] Verify in DB:
  ```sql
  select id, name, created_by, created_at from routes
  where created_at > now() - interval '10 min' order by created_at desc;
  ```

## 8. Route save — localStorage draft

- [ ] In incognito, build a route with 3+ stops
- [ ] Refresh the page (F5)
- [ ] Stops should be restored from localStorage
- [ ] PostHog event `route_draft_restored` should fire (check Network → `/i/v0/e/`)
- [ ] After successful save, refresh again — draft should be cleared (no stops)
- [ ] DevTools → Application → Local Storage → `fyndstigen.route-draft.v1` should be absent

## 9. Search injection guard

- [ ] On `/search`, type `,published_at.is.null` into the search box
- [ ] Should NOT return draft markets (we strip `,()*%\` before injecting into `.or()`)
- [ ] Type `Café (50%)` — searches OK, just strips the special chars

## 10. Performance — Sentry verification

After 1+ hour of staging traffic, check Sentry:
- https://fyndstigen.sentry.io/explore/traces/

For each transaction:
- [ ] `/` p95 should be **<3 s** (was 6.2 s)
- [ ] `/loppis/[slug]` p95 should be **<500 ms** on cache hit (was 2.95 s)
- [ ] `/kvartersloppis/[slug]` should appear with reasonable latency
- [ ] `/utforska` p95 should be **<2 s** (was 4.1 s)
- [ ] `/takeover/:token` p95 should be **<3 s** (was 4.95 s)
- [ ] No new error issues in `is:unresolved firstSeen:-1d`

## 11. Performance — PostHog Web Vitals

After 24h of traffic:

```sql
-- Run in PostHog HogQL Explorer
select properties.name as metric, avg(toFloat(properties.value)) as avg_v, count() as samples
from events where event = 'web_vital' and timestamp >= now() - interval 1 day
group by metric
```

Expected (per Google CWV thresholds):
- [ ] **LCP** average <2500 ms ("good")
- [ ] **CLS** average <0.1
- [ ] **INP** average <200 ms
- [ ] **TTFB** average <800 ms (cache-warm pages should be much faster)

## 12. Cache warm-up cron

- [ ] After ~30 min, query:
  ```sql
  select runid, status, return_message, start_time
  from cron.job_run_details where jobid = 3 order by start_time desc limit 3;
  ```
- [ ] Status should be `succeeded` and return_message contains a request id
- [ ] Sentry: edge function `cache-warmup` should appear in transactions
- [ ] If `failed`: check `return_message` for HTTP status. 401 = service_role_key wrong; 500 = function error.

## 13. Post-deploy DB cleanup

After smoke test, remove test data:
```sql
delete from block_sale_stands where applicant_email = 'your-test@email.com';
delete from block_sales where slug like 'test-%';
delete from routes where created_by = '<your-test-user-id>';
```

(Fix the WHERE clauses to match your test data.)

---

## If anything fails

| Symptom | Likely cause | Fix |
|---|---|---|
| 500 on edge function | Missing env secret | Check `BLOCK_SALE_TOKEN_SECRET` is set |
| Honeypot test passes spam through | Server-side check missing | Verify `route-create-anon` and `block-sale-stand-apply` reject `website` field |
| Cron fires but `failed` | Vault secret missing or wrong | Re-create via `vault.update_secret(...)` |
| Cron fires but `succeeded` with HTTP 401 | service_role_key in vault is wrong | Update to current key |
| `/loppis/[slug]` still slow | ISR cache cold | Wait for cron to warm it (next 30-min tick) |
| PostHog Web Vitals missing | Cookie consent not accepted | Accept cookies in incognito and refresh |

---

## Production deploy

When all checks pass:

1. `git push origin main` — backup commits
2. Build:
   ```powershell
   Set-Location C:\Projects\Loppan\web
   node ..\node_modules\@opennextjs\cloudflare\dist\cli\index.js build
   ```
3. Deploy with prod config (verify `wrangler.production.jsonc` exists; copy from staging if not):
   ```powershell
   Set-Location C:\Projects\Loppan
   node node_modules\wrangler\bin\wrangler.js deploy --config web/wrangler.production.jsonc --x-autoconfig=false
   ```
4. Monitor Sentry for the next hour for any spike in errors.

## Considering a separate staging Supabase

Right now staging and production share **the same Supabase project**. That means:
- Test data on staging pollutes prod data
- A bad migration can wreck prod
- You can't test schema changes in isolation

**Recommendation: Supabase Pro tier ($25/mo)** unlocks:
- **Branching** — git-style preview branches per feature, each with isolated DB
- 8 GB DB (vs 500 MB on free)
- Daily backups + 7-day retention
- 2 GB egress + better rate limits

Migration path:
1. Upgrade to Pro
2. Create a `staging` branch in dashboard
3. Update `web/wrangler.staging.jsonc` env vars to point to staging branch
4. Apply migrations via `supabase db push --branch staging`
5. Deploy edge functions per-branch via Supabase CLI

Until then: be careful with what you create on staging, and prefer
incognito/throwaway emails for test data.
