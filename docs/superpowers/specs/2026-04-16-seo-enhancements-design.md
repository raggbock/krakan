# Flea Market SEO Enhancements — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

Improve the SEO of individual flea market pages (`/fleamarkets/[id]`) by enriching structured data (JSON-LD), metadata, and OpenGraph tags. This makes markets more discoverable on Google and more shareable on social media.

## Scope

**In scope:**
- Extend `getMarketMeta` to return opening hours, price range, and first image
- Richer JSON-LD `LocalBusiness` with `openingHoursSpecification`, `priceRange`, `image`
- New `BreadcrumbList` JSON-LD
- Canonical URL
- Better meta descriptions including city, type, price range, hours
- `og:image` from first market image

**Out of scope:**
- Push notifications (separate sub-project)
- New pages or routes
- Changes to the public-facing UI (this is metadata-only)

## Part 1: Extend `getMarketMeta` in ServerDataPort

**File:** `packages/shared/src/ports/server.ts`

Add three new fields to the return type:

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
- `opening_hour_rules` — select `type, day_of_week, anchor_date, open_time, close_time`
- `market_tables` — compute `min(price_sek)` and `max(price_sek)` where `is_available = true`
- `flea_market_images` — select first image by `sort_order`, build full storage URL

**In-memory adapter** — update seed type to include new fields.

## Part 2: Richer JSON-LD on Market Pages

**File:** `web/src/app/fleamarkets/[id]/layout.tsx`

### LocalBusiness — new fields

**openingHoursSpecification** (from `opening_hour_rules`):

| Rule type | Mapping |
|-----------|---------|
| `weekly` | `{ dayOfWeek: "Monday", opens: "10:00", closes: "17:00" }` |
| `date` | `{ validFrom: "2026-05-01", validThrough: "2026-05-01", opens: "10:00", closes: "17:00" }` |
| `biweekly` | Skip — Schema.org doesn't support biweekly recurrence |

Day-of-week mapping: 0=Sunday → "Sunday", 1=Monday → "Monday", etc.

**priceRange**: Format as `"{min}-{max} SEK"` from `price_range`. Only include if `price_range` is not null.

**image**: Full URL to first market image from Supabase Storage. Only include if `image_url` is not null.

### New BreadcrumbList JSON-LD

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

## Part 3: Improved Metadata

**File:** `web/src/app/fleamarkets/[id]/layout.tsx` (in `generateMetadata`)

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

## Files to Create/Modify

**Modified files:**
- `packages/shared/src/ports/server.ts` — extend `getMarketMeta` return type
- `packages/shared/src/adapters/supabase-server.ts` — join opening_hour_rules, market_tables, flea_market_images
- `packages/shared/src/adapters/in-memory.ts` — update seed type
- `packages/shared/src/adapters.test.ts` — update test seed data
- `web/src/app/fleamarkets/[id]/layout.tsx` — richer JSON-LD, breadcrumbs, metadata
