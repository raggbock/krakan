# Kvartersloppis — Design

**Status:** Spec, awaiting plan
**Date:** 2026-04-30

## Goal

Let any logged-in Fyndstigen user organize a "kvartersloppis" (neighborhood
flea market) — a single dated event covering an area where multiple
households open up their own driveways/yards as stands. Households apply
with a short description and their address; the organizer approves them.
Visitors browse one event page with a map of approved stands.

## Non-goals (MVP)

- Payments / Stripe integration — kvartersloppis is free for everyone
- Individual stand pages with their own URL/SEO indexing
- Reviews, photos on stands, route generation between stands
- "Find one near me" push notifications

## Data model

Two new tables:

```
block_sales (the event)
  id              uuid pk
  organizer_id    uuid fk → user_profiles
  name            text
  slug            text unique  -- "<name>-<city>-<start_date>"
  description     text
  start_date      date
  end_date        date         -- == start_date for one-day events
  daily_open      time
  daily_close     time
  city            text
  region          text
  center_location geography    -- map zoom + city-page sorting
  published_at    timestamptz null
  is_deleted      bool default false
  created_at, updated_at

block_sale_stands (a participant stand)
  id              uuid pk
  block_sale_id   uuid fk → block_sales
  user_id         uuid fk null -- set when guest registers later
  applicant_email text
  applicant_name  text
  street          text
  zip_code        text
  city            text
  location        geography    -- geocoded on submit
  description     text         -- max 200 chars
  status          text         -- 'pending' | 'confirmed' | 'approved' | 'rejected'
  edit_token      text unique  -- signed JWT for guest edit
  email_confirmed_at timestamptz null
  decided_at      timestamptz null
  created_at      timestamptz
```

Stand status flow: `pending` (just submitted) → `confirmed` (gäst clicked
email link) → `approved`/`rejected` (organizer decided).

Stands are not searchable individually and are not route_stops — they
exist only inside one block_sale.

## RLS

`block_sales`:
- SELECT (anon): `published_at IS NOT NULL AND is_deleted = false`
- SELECT/UPDATE/DELETE (organizer): `organizer_id = auth.uid()`
- INSERT: any authenticated user

`block_sale_stands` (via `visible_block_sale_stands` view for public reads):
- SELECT (anon): `status = 'approved'` AND parent published
- SELECT (organizer): all stands in their own block_sales
- INSERT (anon): allowed via edge function only (`block-sale-stand-apply`)
  with status='pending'. Direct table insert blocked by RLS.
- UPDATE: edge function only (`block-sale-decide` for organizer,
  `block-sale-stand-edit` for guest with token)

## Edge functions

Under `supabase/functions/`:

- `block-sale-stand-apply` (POST, anon or authed)
  - Accepts: email, name, street, zip, city, description, block_sale_id,
    plus honeypot field
  - Validates honeypot empty; rejects on hit
  - Rate-limit: 5 submissions/hour/IP via Cloudflare KV
  - Geocodes address via Nominatim
  - If logged in: skip email-confirm; insert with `status='confirmed'` and
    `user_id=auth.uid()`, notify organizer immediately
  - If anon: insert with `status='pending'`, send confirm-email with
    signed token

- `block-sale-stand-confirm` (GET, anon)
  - Validates token, sets `status='confirmed'`, `email_confirmed_at=now()`
  - Sends "ny ansökan att granska" to organizer

- `block-sale-decide` (POST, organizer)
  - Sets `status='approved'` or `'rejected'`
  - Sends decision email to applicant
  - Approved emails include nudge: "skapa konto för att hantera nästa gång"
  - Bulk variant: `block_sale_id` + array of stand_ids

- `block-sale-stand-edit` (PATCH, anon-with-token)
  - Validates edit_token JWT
  - Allows editing description/street (re-geocodes if street changed)

All follow `supabase/functions/_shared/handler.ts` pattern.

## Contracts

`packages/shared/src/contracts/`:

- `block-sale-create.ts` — organizer creates/updates event
- `block-sale-stand-apply.ts` — guest application
- `block-sale-stand-confirm.ts` — guest email confirm
- `block-sale-decide.ts` — organizer approves/rejects (single or bulk)
- `block-sale-stand-edit.ts` — guest edits via token

Endpoints registered in `packages/shared/src/endpoints.ts`.

## Frontend

New routes:

- `/skapa/kvartersloppis` — organizer create form (logged in)
- `/kvartersloppis/<slug>` — public event page
- `/kvartersloppis/<slug>/admin` — organizer queue + approval UI
- `/kvartersloppis/<slug>/min-ansokan?token=...` — guest edit/cancel

Modifications to existing routes:

- `/map` — kvartersloppis pins in new color (lilac) with kvarter icon overlay
  - Pin position = `center_location`
  - Click → preview card → "Visa detaljer" → event page
  - Stand pins render only inside event page, not on `/map`
- `/search` — block_sales mixed with flea_markets, sorted by upcoming date,
  with filter chips "Bara kvartersloppis" / "Bara butiker"
- `/loppisar/[city]` — section "Kvartersloppisar i {city}" above market list
  if any active event
- `/sitemap.ts` — add published kvartersloppis where end_date >= today - 30d

Public event page (`/kvartersloppis/<slug>`):
- Title, description, date span, daily times
- Map with approved stand pins
- Click pin → slide-out panel with description + address; deeplinkable as
  `#stand-<id>`
- "Ansök om eget stånd" CTA until end_date
- After end_date: "Avslutad" banner; CTA hidden

## SEO

- `Event` JSON-LD per day in the date range (so multi-day events get
  multiple rich-result entries)
  - `startDate` = date + daily_open
  - `endDate` = date + daily_close
  - `location` = first approved stand's location, or center_location if no
    approved stands yet
  - `eventStatus`, `eventAttendanceMode = OfflineEventAttendanceMode`
- BreadcrumbList: Fyndstigen → Kvartersloppis → {city} → {name}
- Per-event metadata with title/description, OG image (logo placeholder MVP)
- Sitemap entry priority 0.8, changeFrequency 'daily' until end_date

## Notifications

Email via existing Resend integration (`supabase/functions/_shared/`):

| Trigger | To | Template |
|---|---|---|
| Guest submits | Guest | confirm-application |
| Guest confirms | Organizer | new-application-to-review |
| Organizer approves | Guest | application-approved (with nudge to register) |
| Organizer rejects | Guest | application-rejected |

Templates under `supabase/functions/_shared/email-templates/block-sale-*`.

Deferred email (post-MVP):
- 24h-before reminder to all approved stands
- Day-of-event "live now" notification to organizer

## Anti-spam (defense in depth)

1. **Email-confirm before queue** — pending stands invisible to organizer
   until applicant clicks confirm link. Kills bots that submit to random
   victim emails.
2. **Honeypot** — hidden form field that bots fill but humans don't.
3. **IP rate-limit** — 5 applications/hour/IP via Cloudflare KV.

No captcha — UX cost too high for MVP.

## Lifecycle / GDPR

- Active until `end_date`
- 30 days post-event: still reachable by URL, banner says "Avslutad",
  removed from `/sitemap.ts` and `/search` results
- 1 year post-event: hard-delete personuppgifter (`applicant_email`,
  `applicant_name`); keep stand-pin geo + description for historical
  display (anonymized)

Cron job in edge function `block-sale-archive` runs daily.

## Open questions

- Slug uniqueness when same kvartersloppis is held same date in different
  cities? Slug includes city → safe. But if same name + same city + same
  date (rare): append `-2`. (Same approach as flea_markets.)
- Spam-level: 5/hour/IP could rate-limit shared NAT (offices, schools) —
  monitor and tune.
- Should `block_sale_stand_apply` allow registering immediately if logged
  in (skip email-confirm)? Yes — auth.uid() bypasses confirm step.

## Files touched

**New:**
- `supabase/migrations/00XXX_block_sales.sql` (tables + RLS + view)
- `supabase/functions/block-sale-stand-apply/`
- `supabase/functions/block-sale-stand-confirm/`
- `supabase/functions/block-sale-decide/`
- `supabase/functions/block-sale-stand-edit/`
- `supabase/functions/block-sale-archive/` (cron)
- `supabase/functions/_shared/email-templates/block-sale-*.ts`
- `packages/shared/src/contracts/block-sale-*.ts`
- `web/src/app/kvartersloppis/[slug]/{page,layout}.tsx`
- `web/src/app/kvartersloppis/[slug]/admin/page.tsx`
- `web/src/app/kvartersloppis/[slug]/min-ansokan/page.tsx`
- `web/src/app/skapa/kvartersloppis/page.tsx`
- `web/src/components/block-sale-*` (form, queue, public map)
- `web/src/hooks/use-block-sale*.ts`
- `web/src/lib/query-keys.ts` (add block-sale keys)

**Modified:**
- `web/src/app/sitemap.ts` (add block_sales)
- `web/src/app/map/...` (lilac pins for block_sales)
- `web/src/app/search/...` (mix in block_sales)
- `web/src/app/loppisar/[city]/page.tsx` (block_sale section)
- `packages/shared/src/ports/server.ts` (add `listPublishedBlockSaleIds`,
  `getBlockSaleMeta`)
- `packages/shared/src/endpoints.ts`
