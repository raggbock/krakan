# Skyltfönstret Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate enhanced SEO and advanced analytics behind the "Skyltfönstret" premium tier (`subscription_tier >= 1`), giving free-tier organizers a reason to upgrade.

**Architecture:** Extend `getMarketMeta` in the shared package to return opening hours, price range, image, and organizer subscription tier. The market layout conditionally renders rich JSON-LD/breadcrumbs/og:image for premium organizers. The stats dashboard splits cards into free (bookings, revenue, routes) and premium (page views, conversion, per-market table), showing locked placeholders for free-tier.

**Tech Stack:** TypeScript, Next.js (server components for SEO, client components for dashboard), Supabase, Schema.org JSON-LD, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-16-skyltfonstret-design.md`

---

### Task 1: Extend ServerDataPort with new getMarketMeta fields

**Files:**
- Modify: `packages/shared/src/ports/server.ts`

- [ ] **Step 1: Update the getMarketMeta return type**

In `packages/shared/src/ports/server.ts`, replace the `getMarketMeta` definition:

```typescript
getMarketMeta(id: string): Promise<{
  name: string
  description: string | null
  city: string
  street: string
  zip_code: string
  latitude: number | null
  longitude: number | null
  is_permanent: boolean
  organizer_subscription_tier: number
  opening_hour_rules: {
    type: string
    day_of_week: number | null
    anchor_date: string | null
    open_time: string
    close_time: string
  }[]
  price_range: { min_sek: number; max_sek: number } | null
  image_url: string | null
} | null>
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit`
Expected: Errors in adapters (they don't return the new fields yet). That's expected — we fix them in Task 2 and 3.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/ports/server.ts
git commit -m "feat: extend ServerDataPort getMarketMeta with SEO and tier fields"
```

---

### Task 2: Update Supabase adapter for getMarketMeta

**Files:**
- Modify: `packages/shared/src/adapters/supabase-server.ts`

- [ ] **Step 1: Update the getMarketMeta query**

Replace the `getMarketMeta` method in `packages/shared/src/adapters/supabase-server.ts`:

```typescript
async getMarketMeta(id) {
  const { data: market } = await supabase
    .from('flea_markets')
    .select(`
      name, description, city, street, zip_code, is_permanent, latitude, longitude,
      organizer:profiles!organizer_id(subscription_tier),
      opening_hour_rules(type, day_of_week, anchor_date, open_time, close_time),
      market_tables(price_sek, is_available),
      flea_market_images(storage_path, sort_order)
    `)
    .eq('id', id)
    .single()

  if (!market) return null

  // Extract organizer subscription tier
  const organizer = market.organizer as unknown as { subscription_tier: number } | null
  const organizer_subscription_tier = organizer?.subscription_tier ?? 0

  // Extract opening hour rules
  const opening_hour_rules = ((market.opening_hour_rules as unknown as Array<{
    type: string; day_of_week: number | null; anchor_date: string | null
    open_time: string; close_time: string
  }>) ?? [])

  // Compute price range from available tables
  const tables = (market.market_tables as unknown as Array<{ price_sek: number; is_available: boolean }>) ?? []
  const availableTables = tables.filter((t) => t.is_available)
  const price_range = availableTables.length > 0
    ? {
        min_sek: Math.min(...availableTables.map((t) => t.price_sek)),
        max_sek: Math.max(...availableTables.map((t) => t.price_sek)),
      }
    : null

  // Get first image URL
  const images = (market.flea_market_images as unknown as Array<{ storage_path: string; sort_order: number }>) ?? []
  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order)
  const firstImage = sortedImages[0]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || supabase['supabaseUrl'] || ''
  const image_url = firstImage
    ? `${supabaseUrl}/storage/v1/object/public/flea-market-images/${firstImage.storage_path}`
    : null

  return {
    name: market.name,
    description: market.description,
    city: market.city,
    street: market.street,
    zip_code: market.zip_code,
    latitude: market.latitude,
    longitude: market.longitude,
    is_permanent: market.is_permanent,
    organizer_subscription_tier,
    opening_hour_rules,
    price_range,
    image_url,
  }
},
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit`
Expected: Still errors from in-memory adapter (Task 3). Supabase adapter should be clean.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/adapters/supabase-server.ts
git commit -m "feat: extend supabase getMarketMeta with SEO joins"
```

---

### Task 3: Update in-memory adapter and tests

**Files:**
- Modify: `packages/shared/src/adapters/in-memory.ts`
- Modify: `packages/shared/src/adapters.test.ts`

- [ ] **Step 1: Update in-memory adapter seed type**

The `MarketMeta` type in `packages/shared/src/adapters/in-memory.ts` is derived from the port, so it automatically picks up the new fields. No code change needed in the adapter itself — it returns seed data as-is.

Verify by checking: `type MarketMeta = Awaited<ReturnType<ServerDataPort['getMarketMeta']>>` on line 38 already derives from the updated port.

- [ ] **Step 2: Update test seed data**

In `packages/shared/src/adapters.test.ts`, update the market seed to include new fields:

```typescript
const seed = {
  markets: [
    {
      id: 'm1',
      updatedAt: '2026-01-01',
      name: 'Stortorget',
      description: 'En loppis',
      city: 'Stockholm',
      street: 'Storgatan 1',
      zip_code: '111 22',
      latitude: 59.33,
      longitude: 18.07,
      is_permanent: true,
      organizer_subscription_tier: 1,
      opening_hour_rules: [
        { type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
      ],
      price_range: { min_sek: 100, max_sek: 300 },
      image_url: 'https://example.com/storage/v1/object/public/flea-market-images/test.jpg',
    },
  ],
  routes: [
    {
      id: 'r1',
      updatedAt: '2026-02-01',
      name: 'Södermalm-rundan',
      description: 'Tre loppisar',
      stopCount: 3,
    },
  ],
}
```

- [ ] **Step 3: Add a test for the new fields**

Add after the existing `getMarketMeta` tests:

```typescript
it('getMarketMeta returns SEO fields for premium market', async () => {
  const server = createInMemoryServerData(seed)
  const market = await server.getMarketMeta('m1')
  expect(market?.organizer_subscription_tier).toBe(1)
  expect(market?.opening_hour_rules).toHaveLength(1)
  expect(market?.opening_hour_rules[0].type).toBe('weekly')
  expect(market?.price_range).toEqual({ min_sek: 100, max_sek: 300 })
  expect(market?.image_url).toContain('test.jpg')
})
```

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/adapters/in-memory.ts packages/shared/src/adapters.test.ts
git commit -m "feat: update in-memory adapter and tests for extended getMarketMeta"
```

---

### Task 4: Premium JSON-LD and metadata on market pages

**Files:**
- Modify: `web/src/app/fleamarkets/[id]/layout.tsx`

- [ ] **Step 1: Add day-of-week mapping helper**

At the top of the file (after imports), add:

```typescript
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
```

- [ ] **Step 2: Update generateMetadata for premium**

Replace the `generateMetadata` function:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const market = await getServerData().getMarketMeta(id)
  if (!market) {
    return { title: 'Loppis hittades inte' }
  }

  const isPremium = market.organizer_subscription_tier >= 1
  const title = market.name

  let description: string
  if (market.description) {
    description = market.description.slice(0, 160)
  } else if (isPremium && market.price_range) {
    description = `${market.name} i ${market.city}. ${market.is_permanent ? 'Permanent' : 'Tillfällig'} loppis. Bord från ${market.price_range.min_sek} kr. Hitta öppettider och boka bord på Fyndstigen.`
  } else {
    description = `${market.name} i ${market.city}. Hitta öppettider, adress och boka bord på Fyndstigen.`
  }

  return {
    title,
    description,
    alternates: isPremium ? { canonical: `https://fyndstigen.se/fleamarkets/${id}` } : undefined,
    openGraph: {
      title: `${market.name} — Fyndstigen`,
      description,
      type: 'website',
      locale: 'sv_SE',
      ...(isPremium && market.image_url ? { images: [{ url: market.image_url }] } : {}),
    },
  }
}
```

- [ ] **Step 3: Update layout component with premium JSON-LD and breadcrumbs**

Replace the `FleaMarketLayout` function:

```typescript
export default async function FleaMarketLayout({ params, children }: Props) {
  const { id } = await params
  const market = await getServerData().getMarketMeta(id)

  const isPremium = market ? market.organizer_subscription_tier >= 1 : false

  const jsonLd = market
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: market.name,
        description: market.description,
        address: {
          '@type': 'PostalAddress',
          streetAddress: market.street,
          postalCode: market.zip_code,
          addressLocality: market.city,
          addressCountry: 'SE',
        },
        ...(market.latitude && market.longitude
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: market.latitude,
                longitude: market.longitude,
              },
            }
          : {}),
        url: `https://fyndstigen.se/fleamarkets/${id}`,
        // Premium-only fields:
        ...(isPremium && market.opening_hour_rules.length > 0
          ? {
              openingHoursSpecification: market.opening_hour_rules
                .filter((r) => r.type !== 'biweekly')
                .map((r) => ({
                  '@type': 'OpeningHoursSpecification',
                  ...(r.type === 'weekly' && r.day_of_week !== null
                    ? { dayOfWeek: SCHEMA_DAYS[r.day_of_week] }
                    : {}),
                  ...(r.type === 'date' && r.anchor_date
                    ? { validFrom: r.anchor_date, validThrough: r.anchor_date }
                    : {}),
                  opens: r.open_time.slice(0, 5),
                  closes: r.close_time.slice(0, 5),
                })),
            }
          : {}),
        ...(isPremium && market.price_range
          ? { priceRange: `${market.price_range.min_sek}-${market.price_range.max_sek} SEK` }
          : {}),
        ...(isPremium && market.image_url ? { image: market.image_url } : {}),
      }
    : null

  const breadcrumbLd = market && isPremium
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
          { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/search' },
          { '@type': 'ListItem', position: 3, name: market.city, item: `https://fyndstigen.se/search?city=${encodeURIComponent(market.city)}` },
          { '@type': 'ListItem', position: 4, name: market.name },
        ],
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      {breadcrumbLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
        />
      )}
      {children}
    </>
  )
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/app/fleamarkets/[id]/layout.tsx
git commit -m "feat: add premium SEO — rich JSON-LD, breadcrumbs, og:image for Skyltfönstret"
```

---

### Task 5: Gate advanced stats behind Skyltfönstret

**Files:**
- Modify: `web/src/app/arrangorer/[id]/statistik/page.tsx`

- [ ] **Step 1: Add LockedStatCard component and profile fetch**

At the top of the file, add a new component and the necessary imports. Replace the full file content with:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useOrganizerStats } from '@/hooks/use-organizer-stats'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="vintage-card p-5">
      <p className="text-sm text-espresso/60 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-espresso/45 mt-1">Totalt: {subValue}</p>}
    </div>
  )
}

function LockedStatCard({ label }: { label: string }) {
  return (
    <div className="vintage-card p-5 relative overflow-hidden">
      <p className="text-sm text-espresso/60 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-espresso/15">—</p>
      <div className="absolute inset-0 flex items-center justify-center bg-parchment/80">
        <div className="text-center px-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto mb-1.5 text-espresso/30">
            <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-xs font-medium text-espresso/50">Skyltfönstret</p>
        </div>
      </div>
    </div>
  )
}

export default function OrganizerStatsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { markets, totals, loading, error } = useOrganizerStats(user?.id === id ? id : undefined)
  const [isPremium, setIsPremium] = useState(false)
  const [tierLoading, setTierLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.organizers.get(id)
      .then((org) => setIsPremium((org?.subscription_tier ?? 0) >= 1))
      .catch(() => setIsPremium(false))
      .finally(() => setTierLoading(false))
  }, [id])

  useEffect(() => {
    if (!authLoading && (!user || user.id !== id)) {
      router.replace(`/arrangorer/${id}`)
    }
  }, [authLoading, user, id, router])

  if (authLoading || loading || tierLoading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!user || user.id !== id) return null

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="vintage-card p-6 text-center">
          <p className="text-espresso/60">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <Link href={`/arrangorer/${id}`} className="text-sm text-rust hover:text-rust-light transition-colors">
            &larr; Tillbaka till profil
          </Link>
          <h1 className="font-display text-2xl font-bold mt-2">Statistik</h1>
          <p className="text-sm text-espresso/60 mt-1">Senaste 30 dagarna</p>
        </div>
      </div>

      {/* Summary cards — free stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up delay-1">
        {isPremium ? (
          <StatCard
            label="Sidvisningar"
            value={totals.pageviews_30d.toLocaleString('sv-SE')}
            subValue={totals.pageviews_total.toLocaleString('sv-SE')}
          />
        ) : (
          <LockedStatCard label="Sidvisningar" />
        )}
        <StatCard
          label="Bokningar"
          value={totals.bookings_30d.toLocaleString('sv-SE')}
          subValue={totals.bookings_total.toLocaleString('sv-SE')}
        />
        <StatCard
          label="Intäkter"
          value={`${totals.revenue_30d_sek.toLocaleString('sv-SE')} kr`}
          subValue={`${totals.revenue_total_sek.toLocaleString('sv-SE')} kr`}
        />
        <StatCard
          label="I rundor"
          value={totals.route_count_30d.toLocaleString('sv-SE')}
          subValue={totals.route_count_total.toLocaleString('sv-SE')}
        />
      </div>

      {/* Conversion — premium only */}
      {isPremium && totals.conversion_30d > 0 && (
        <div className="vintage-card p-5 mb-8 animate-fade-up delay-2">
          <p className="text-sm text-espresso/60 mb-1">Konvertering (besök till bokning)</p>
          <p className="font-display text-2xl font-bold">{totals.conversion_30d}%</p>
        </div>
      )}

      {!isPremium && (
        <div className="vintage-card p-5 mb-8 relative overflow-hidden animate-fade-up delay-2">
          <p className="text-sm text-espresso/60 mb-1">Konvertering (besök till bokning)</p>
          <p className="font-display text-2xl font-bold text-espresso/15">—</p>
          <div className="absolute inset-0 flex items-center justify-center bg-parchment/80">
            <div className="text-center px-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto mb-1.5 text-espresso/30">
                <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium text-espresso/50">Skyltfönstret</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-market breakdown — premium only */}
      {isPremium && markets.length > 1 && (
        <div className="animate-fade-up delay-3">
          <h2 className="font-display text-xl font-bold mb-4">Per loppis</h2>
          <div className="vintage-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-espresso/10">
                    <th className="text-left p-4 font-medium text-espresso/60">Loppis</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Visningar</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Bokningar</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Intäkter</th>
                    <th className="text-right p-4 font-medium text-espresso/60">I rundor</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Konv.</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((market) => (
                    <tr key={market.flea_market_id} className="border-b border-espresso/5 last:border-0">
                      <td className="p-4 font-medium">
                        <Link href={`/fleamarkets/${market.flea_market_id}`} className="text-rust hover:text-rust-light transition-colors">
                          {market.name}
                        </Link>
                      </td>
                      <td className="text-right p-4">{market.pageviews_30d.toLocaleString('sv-SE')}</td>
                      <td className="text-right p-4">{(market.bookings_30d.confirmed + market.bookings_30d.pending).toLocaleString('sv-SE')}</td>
                      <td className="text-right p-4">{market.revenue_30d_sek.toLocaleString('sv-SE')} kr</td>
                      <td className="text-right p-4">{market.route_count_30d.toLocaleString('sv-SE')}</td>
                      <td className="text-right p-4">{market.conversion_30d > 0 ? `${market.conversion_30d}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!isPremium && markets.length > 1 && (
        <div className="vintage-card p-8 text-center animate-fade-up delay-3">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="mx-auto mb-2 text-espresso/30">
            <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="font-display font-bold mb-1">Detaljerad statistik per loppis</p>
          <p className="text-sm text-espresso/60">Uppgradera till Skyltfönstret för att se visningar, konvertering och mer per loppis.</p>
        </div>
      )}

      {/* Skyltfönstret upsell banner for free tier */}
      {!isPremium && (
        <div className="vintage-card p-6 mt-8 bg-mustard/5 border-mustard/20 animate-fade-up delay-4">
          <h3 className="font-display font-bold text-lg mb-2">Skyltfönstret</h3>
          <p className="text-sm text-espresso/70 mb-3">
            Ställ ut din loppis i Skyltfönstret och få tillgång till egen SEO, detaljerad statistik och mer synlighet.
          </p>
          <ul className="text-sm text-espresso/70 space-y-1 mb-4">
            <li>&#10003; Bättre synlighet på Google</li>
            <li>&#10003; Sidvisningar och konvertering</li>
            <li>&#10003; Statistik per loppis</li>
          </ul>
          <p className="text-xs text-espresso/50">Kontakta oss för att uppgradera.</p>
        </div>
      )}

      {/* Empty state */}
      {markets.length === 0 && (
        <div className="vintage-card p-8 text-center animate-fade-up delay-2">
          <p className="text-espresso/60">Du har inga publicerade loppisar ännu.</p>
          <Link href="/fleamarkets/new" className="text-rust mt-2 inline-block">
            Skapa din första loppis &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/arrangorer/[id]/statistik/page.tsx
git commit -m "feat: gate advanced stats behind Skyltfönstret premium tier"
```
