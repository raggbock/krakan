# Skyltfönstret — Premium Organizer Features Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

"Skyltfönstret" is a premium tier for organizers on Fyndstigen. Organizers who upgrade get enhanced SEO on their market pages (richer JSON-LD, breadcrumbs, og:image, better meta descriptions) and access to advanced analytics (page views, conversion rates, per-market breakdown). Free-tier organizers keep basic stats (bookings, revenue, route inclusions) and basic SEO (name, address, geo).

Premium is gated on the existing `subscription_tier` field on profiles (0=free, 1=premium).

**Swedish branding:** "Ställ ut din loppis i Skyltfönstret och få tillgång till egen SEO, mer statistik och sponsrade inlägg på sociala medier."

## Scope

**In scope (v1):**
- Extend `getMarketMeta` to return opening hours, price range, first image, and organizer subscription tier
- Premium SEO: richer JSON-LD (`openingHoursSpecification`, `priceRange`, `image`), `BreadcrumbList`, canonical URL, better meta descriptions, `og:image`
- Gate premium SEO behind `subscription_tier >= 1`
- Gate advanced dashboard stats behind `subscription_tier >= 1`
- Show blurred/locked premium stats with "Uppgradera till Skyltfönstret" CTA for free-tier

**Out of scope:**
- Push notifications (separate sub-project)
- Sponsored social media posts (separate sub-project)
- Payment/upgrade flow for Skyltfönstret (separate — for now, tier is set manually in DB)
- New pages or routes beyond dashboard changes

## Part 1: Extend `getMarketMeta` in ServerDataPort

**File:** `packages/shared/src/ports/server.ts`

Add new fields to the return type:

```typescript
getMarketMeta(id: string): Promise<{
  // existing fields...
  name: string
  description: string | null
  city: string
  street: string
  zip_code: string
  latitude: number | null
  longitude: number | null
  is_permanent: boolean
  // new fields:
  organizer_subscription_tier: number
  opening_hour_rules: {
    type: string        // 'weekly' | 'biweekly' | 'date'
    day_of_week: number | null
    anchor_date: string | null
    open_time: string
    close_time: string
  }[]
  price_range: { min_sek: number; max_sek: number } | null
  image_url: string | null
} | null>
```

**Supabase adapter** (`packages/shared/src/adapters/supabase-server.ts`):

Update the `getMarketMeta` query to join:
- `profiles` (via `organizer_id`) — select `subscription_tier`
- `opening_hour_rules` — select `type, day_of_week, anchor_date, open_time, close_time`
- `market_tables` — compute `min(price_sek)` and `max(price_sek)` where `is_available = true`
- `flea_market_images` — select first image by `sort_order`, build full storage URL

`getMarketMeta` always fetches all data. The layout decides what to render based on tier.

**In-memory adapter** — update seed type to include new fields.

## Part 2: Premium SEO on Market Pages

**File:** `web/src/app/fleamarkets/[id]/layout.tsx`

All markets get basic JSON-LD (name, address, geo, url) as today. Premium markets (`organizer_subscription_tier >= 1`) additionally get:

### LocalBusiness — premium fields

**openingHoursSpecification** (from `opening_hour_rules`):

| Rule type | Mapping |
|-----------|---------|
| `weekly` | `{ dayOfWeek: "Monday", opens: "10:00", closes: "17:00" }` |
| `date` | `{ validFrom: "2026-05-01", validThrough: "2026-05-01", opens: "10:00", closes: "17:00" }` |
| `biweekly` | Skip — Schema.org doesn't support biweekly recurrence |

Day-of-week mapping: 0=Sunday → "Sunday", 1=Monday → "Monday", etc.

**priceRange**: Format as `"{min}-{max} SEK"` from `price_range`. Only include if not null.

**image**: Full URL to first market image. Only include if not null.

### BreadcrumbList JSON-LD (premium only)

Separate `<script type="application/ld+json">` tag:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Fyndstigen", "item": "https://fyndstigen.se" },
    { "@type": "ListItem", "position": 2, "name": "Loppisar", "item": "https://fyndstigen.se/search" },
    { "@type": "ListItem", "position": 3, "name": "{city}", "item": "https://fyndstigen.se/search?city={city}" },
    { "@type": "ListItem", "position": 4, "name": "{market.name}" }
  ]
}
```

## Part 3: Improved Metadata (premium)

**File:** `web/src/app/fleamarkets/[id]/layout.tsx` (in `generateMetadata`)

For premium organizers:

**Canonical URL:**
```typescript
alternates: {
  canonical: `https://fyndstigen.se/fleamarkets/${id}`,
}
```

**Better description** (when market has no custom description):

Template: `"{name} i {city}. {Permanent/Tillfällig} loppis.{price} Hitta öppettider och boka bord på Fyndstigen."`

Where `{price}` is ` Bord från {min} kr.` if `price_range` exists, otherwise empty.

**og:image:**
```typescript
openGraph: {
  images: market.image_url ? [{ url: market.image_url }] : [],
}
```

Free-tier markets keep the current metadata behavior (basic title + description).

## Part 4: Dashboard Stats Gate

**File:** `web/src/app/arrangorer/[id]/statistik/page.tsx`

### Free tier sees:
- Bokningar (antal per status) — full data, 30d + totalt
- Intäkter — full data, 30d + totalt
- I rundor — full data, 30d + totalt

### Skyltfönstret sees (in addition):
- Sidvisningar — full data
- Konvertering — full data
- Per-loppis breakdown table

### Locked stats display:
Free-tier organizers see locked premium stats as blurred cards with overlay:
- Card content is replaced with placeholder values (e.g., "—")
- A semi-transparent overlay with lock icon and text: "Uppgradera till Skyltfönstret"
- No actual data is shown (don't blur real data — just show empty placeholder cards with the CTA)

### Implementation:
- Fetch `subscription_tier` from the user's profile (already available via `useAuth` or a profile query)
- Pass `isPremium` boolean to the stats page
- Conditionally render full stats or locked placeholders
- The `useOrganizerStats` hook still fetches all data (simpler), but the UI gates what's shown

## Files to Create/Modify

**Modified files:**
- `packages/shared/src/ports/server.ts` — extend `getMarketMeta` return type
- `packages/shared/src/adapters/supabase-server.ts` — join profiles, opening_hour_rules, market_tables, flea_market_images
- `packages/shared/src/adapters/in-memory.ts` — update seed type
- `packages/shared/src/adapters.test.ts` — update test seed data
- `web/src/app/fleamarkets/[id]/layout.tsx` — premium JSON-LD, breadcrumbs, metadata
- `web/src/app/arrangorer/[id]/statistik/page.tsx` — gate advanced stats, locked cards UI
