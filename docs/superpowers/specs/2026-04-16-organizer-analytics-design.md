# Organizer Analytics Dashboard — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

Add analytics for flea market organizers: custom PostHog event tracking, a server-side edge function for fetching PostHog data, and a dashboard page showing key stats. This gives organizers visibility into how their markets perform — page views, bookings, revenue, route inclusions, and conversion rates.

## Scope

**In scope (v1):**
- Custom PostHog events for route and booking actions
- Organizer statistics dashboard at `/arrangorer/[id]/statistik`
- Edge function for server-side PostHog API access
- Fixed time periods: "last 30 days" + "all time"

**Out of scope (future):**
- Push notifications / radius-based alerts
- Enhanced SEO beyond what already exists
- Traffic source breakdown
- Comparison with averages
- Selectable time periods
- Pro/premium feature gating

## Part 1: Custom PostHog Events

Three new events, all including `flea_market_id` as a property:

| Event | Trigger | Component | Extra Properties |
|-------|---------|-----------|-----------------|
| `route_market_added` | User adds a market to their route | `web/src/components/route-builder.tsx` | `market_name`, `market_city` |
| `route_saved` | Route is saved to DB | `web/src/components/route-builder.tsx` | `route_id`, `stop_count`, `market_ids[]` |
| `booking_initiated` | User starts a booking | `web/src/hooks/use-booking.ts` | `market_name`, `table_label`, `price_sek`, `is_free` |

Uses the existing `usePostHog()` hook from `posthog-js/react`. No new dependencies.

## Part 2: Edge Function — `organizer-stats`

**Endpoint:** `POST /organizer-stats`

**Auth:** Requires JWT. Verifies that the calling user matches the requested `organizer_id`.

**Request body:**
```json
{ "organizer_id": "uuid" }
```

**Flow:**
1. Verify JWT user == `organizer_id`
2. Fetch the organizer's `flea_market_id`s from Supabase
3. Call PostHog Events API filtering `$pageview` events where `$current_url` matches `/fleamarkets/{id}` for each market
4. Fetch `booking_initiated` events per market (for conversion calculation)
5. Return aggregated counts

**Response:**
```json
{
  "markets": [
    {
      "flea_market_id": "uuid",
      "name": "Söder Loppis",
      "pageviews_30d": 142,
      "pageviews_total": 891,
      "bookings_initiated_30d": 23
    }
  ]
}
```

**PostHog API key:** Stored as Supabase secret (`POSTHOG_PRIVATE_API_KEY`). Uses the PostHog `/api/events` endpoint with property filters.

Uses `createHandler()` from `_shared/handler.ts` following existing edge function conventions.

## Part 3: Dashboard Page

**Route:** `/arrangorer/[id]/statistik`

**Access control:** Client-side check — if the logged-in user does not match the organizer, redirect to `/arrangorer/[id]`.

### Data Sources

| Stat | Source | How |
|------|--------|-----|
| Page views per market | PostHog API (via edge function) | `$pageview` events filtered by URL |
| Bookings by status (30d + total) | Supabase | Query `bookings` filtered on organizer's markets |
| Revenue (after commission) | Supabase | Sum `price_sek - commission_sek` from confirmed bookings |
| Route inclusions | Supabase | Count `route_stops` per `flea_market_id` |
| Conversion rate | Calculated | `booking_initiated / pageviews` per market |

### UI Layout

- **Top row:** 4 summary cards — Page Views, Bookings, Revenue (SEK), In Routes
  - Each card shows the 30-day value prominently with a smaller "totalt" figure beneath
- **Below:** Per-market breakdown table (if organizer has multiple markets)
  - Columns: Market name, Page views, Bookings, Revenue, In routes, Conversion %
- **No new DB tables required** — all data comes from existing tables + PostHog

### Supabase Queries

**Bookings stats:**
```sql
SELECT
  flea_market_id,
  status,
  COUNT(*) as count,
  SUM(price_sek - commission_sek) FILTER (WHERE status = 'confirmed') as revenue_sek
FROM bookings
WHERE flea_market_id IN (SELECT id FROM flea_markets WHERE organizer_id = $1)
GROUP BY flea_market_id, status;
```

With a 30-day variant adding `AND created_at >= now() - interval '30 days'`.

**Route inclusions:**
```sql
SELECT
  flea_market_id,
  COUNT(*) as route_count
FROM route_stops
WHERE flea_market_id IN (SELECT id FROM flea_markets WHERE organizer_id = $1)
GROUP BY flea_market_id;
```

With a 30-day variant adding `AND created_at >= now() - interval '30 days'`.

## Files to Create/Modify

**New files:**
- `supabase/functions/organizer-stats/index.ts` — Edge function
- `web/src/app/arrangorer/[id]/statistik/page.tsx` — Dashboard page

**Modified files:**
- `web/src/components/route-builder.tsx` — Add PostHog event captures
- `web/src/hooks/use-booking.ts` — Add `booking_initiated` event capture
