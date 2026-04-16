# Organizer Analytics Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give flea market organizers a statistics dashboard showing page views, bookings, revenue, route inclusions, and conversion rates.

**Architecture:** Three parts — (1) add PostHog custom event captures in route-builder and booking hook, (2) create an `organizer-stats` edge function that fetches PostHog data server-side, (3) build a dashboard page at `/arrangorer/[id]/statistik` combining DB stats with PostHog data.

**Tech Stack:** PostHog JS (`usePostHog`), Supabase Edge Functions (Deno), Next.js, TanStack Query, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-16-organizer-analytics-design.md`

---

### Task 1: Add PostHog event captures in route-builder

**Files:**
- Modify: `web/src/components/route-builder.tsx`

- [ ] **Step 1: Add PostHog import**

At top of `route-builder.tsx`, add:

```tsx
import { usePostHog } from 'posthog-js/react'
```

Inside `RouteBuilder` component, add:

```tsx
const posthog = usePostHog()
```

- [ ] **Step 2: Add `route_market_added` event in `toggleMarket`**

In the `toggleMarket` function, after the market is added (the `else` branch at line ~81), add the capture:

```tsx
function toggleMarket(market: MarketWithHours) {
  if (isInRoute(market.id)) {
    setStops((prev) => prev.filter((s) => s.market.id !== market.id))
  } else {
    setStops((prev) => [
      ...prev,
      { market, index: prev.length },
    ])
    posthog?.capture('route_market_added', {
      flea_market_id: market.id,
      market_name: market.name,
      market_city: market.city,
    })
  }
}
```

- [ ] **Step 3: Add `route_saved` event in `handleSave`**

In the `handleSave` function, after the route is created successfully (after `api.routes.create` returns, before `router.push`):

```tsx
async function handleSave() {
  if (!user || !name.trim() || stops.length === 0) return
  setSaving(true)
  try {
    const startLat = !useGps && customStart ? customStart.lat : userPos?.lat
    const startLng = !useGps && customStart ? customStart.lng : userPos?.lng

    const { id } = await api.routes.create({
      name: name.trim(),
      createdBy: user.id,
      startLatitude: startLat,
      startLongitude: startLng,
      plannedDate: plannedDate || undefined,
      stops: stops.map((s) => ({ fleaMarketId: s.market.id })),
    })
    posthog?.capture('route_saved', {
      route_id: id,
      stop_count: stops.length,
      market_ids: stops.map((s) => s.market.id),
    })
    router.push(`/rundor/${id}`)
  } catch {
    setSaveError('Kunde inte spara rundan. Försök igen.')
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 4: Verify the app builds**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/route-builder.tsx
git commit -m "feat: add PostHog event tracking to route builder"
```

---

### Task 2: Add PostHog event capture in booking hook

**Files:**
- Modify: `web/src/hooks/use-booking.ts`

- [ ] **Step 1: Add PostHog import**

At top of `use-booking.ts`, add:

```tsx
import { usePostHog } from 'posthog-js/react'
```

Inside `useBooking`, add:

```tsx
const posthog = usePostHog()
```

- [ ] **Step 2: Add `booking_initiated` event in `submit`**

In the `submit` callback, right after `setIsSubmitting(true)` and `setSubmitError(null)`, before the try/catch body fetches session:

```tsx
const submit = useCallback(async () => {
  if (!canSubmit || !selectedTable) return
  setIsSubmitting(true)
  setSubmitError(null)
  posthog?.capture('booking_initiated', {
    flea_market_id: marketId,
    market_name: selectedTable.label,
    table_label: selectedTable.label,
    price_sek: selectedTable.price_sek,
    is_free: isFree,
  })
  try {
    // ... rest of existing code
```

Note: `posthog` must be added to the `useCallback` dependency array. The full dependency list becomes:
```tsx
}, [canSubmit, selectedTable, stripe, elements, marketId, date, message, posthog, isFree])
```

- [ ] **Step 3: Verify the app builds**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run existing booking tests to check for regressions**

Run: `cd web && node ../node_modules/vitest/vitest.mjs run src/hooks/use-booking.test.ts`
Expected: All tests pass. The PostHog mock is auto-handled since `usePostHog` returns `undefined` in test context and we use `posthog?.capture` (optional chaining).

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/use-booking.ts
git commit -m "feat: add PostHog booking_initiated event tracking"
```

---

### Task 3: Create `organizer-stats` edge function

**Files:**
- Create: `supabase/functions/organizer-stats/index.ts`

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/organizer-stats/index.ts`:

```typescript
import { createHandler, ForbiddenError, HttpError } from '../_shared/handler.ts'

createHandler(async ({ user, admin, body }) => {
  const { organizer_id } = body as { organizer_id?: string }

  if (!organizer_id) {
    throw new HttpError(400, 'Missing required field: organizer_id')
  }

  if (user.id !== organizer_id) {
    throw new ForbiddenError('You can only view your own stats')
  }

  // Get organizer's flea markets
  const { data: markets, error: marketsErr } = await admin
    .from('flea_markets')
    .select('id, name')
    .eq('organizer_id', organizer_id)
    .eq('is_deleted', false)

  if (marketsErr) throw new Error('Failed to fetch markets')
  if (!markets || markets.length === 0) return { markets: [] }

  const marketIds = markets.map((m: { id: string }) => m.id)

  // Fetch PostHog pageview data
  const posthogKey = Deno.env.get('POSTHOG_PRIVATE_API_KEY')
  const posthogHost = Deno.env.get('POSTHOG_HOST') || 'https://eu.i.posthog.com'

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const result = await Promise.all(
    markets.map(async (market: { id: string; name: string }) => {
      let pageviews30d = 0
      let pageviewsTotal = 0
      let bookingsInitiated30d = 0

      if (posthogKey) {
        const urlPattern = `/fleamarkets/${market.id}`

        // Pageviews last 30 days
        const pv30 = await queryPostHog(posthogHost, posthogKey, {
          event: '$pageview',
          properties: [{ key: '$current_url', value: urlPattern, operator: 'icontains' }],
          after: thirtyDaysAgo,
        })
        pageviews30d = pv30

        // Pageviews all time
        const pvAll = await queryPostHog(posthogHost, posthogKey, {
          event: '$pageview',
          properties: [{ key: '$current_url', value: urlPattern, operator: 'icontains' }],
        })
        pageviewsTotal = pvAll

        // Booking initiated last 30 days
        const bi30 = await queryPostHog(posthogHost, posthogKey, {
          event: 'booking_initiated',
          properties: [{ key: 'flea_market_id', value: market.id, operator: 'exact' }],
          after: thirtyDaysAgo,
        })
        bookingsInitiated30d = bi30
      }

      return {
        flea_market_id: market.id,
        name: market.name,
        pageviews_30d: pageviews30d,
        pageviews_total: pageviewsTotal,
        bookings_initiated_30d: bookingsInitiated30d,
      }
    })
  )

  return { markets: result }
})

async function queryPostHog(
  host: string,
  apiKey: string,
  params: {
    event: string
    properties: { key: string; value: string; operator: string }[]
    after?: string
  },
): Promise<number> {
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')
  if (!projectId) return 0

  const body = {
    query: {
      kind: 'EventsQuery',
      event: params.event,
      properties: params.properties,
      ...(params.after ? { after: params.after } : {}),
      select: ['count()'],
    },
  }

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) return 0

    const data = await res.json()
    // HogQL query returns results as array of arrays
    return data.results?.[0]?.[0] ?? 0
  } catch {
    return 0
  }
}
```

- [ ] **Step 2: Verify the function matches the handler pattern**

Check that it follows the same pattern as `booking-create/index.ts`: imports `createHandler` from `../_shared/handler.ts`, uses `{ user, admin, body }` destructuring, throws `HttpError`/`ForbiddenError` for validation.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/organizer-stats/index.ts
git commit -m "feat: add organizer-stats edge function with PostHog integration"
```

---

### Task 4: Add DB stats queries — bookings and route inclusions

**Files:**
- Create: `web/src/hooks/use-organizer-stats.ts`

- [ ] **Step 1: Create the hook**

Create `web/src/hooks/use-organizer-stats.ts`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type MarketBookingStats = {
  flea_market_id: string
  pending: number
  confirmed: number
  denied: number
  cancelled: number
  revenue_sek: number
}

type MarketRouteStats = {
  flea_market_id: string
  route_count: number
}

type PostHogMarketStats = {
  flea_market_id: string
  name: string
  pageviews_30d: number
  pageviews_total: number
  bookings_initiated_30d: number
}

export type MarketStats = {
  flea_market_id: string
  name: string
  pageviews_30d: number
  pageviews_total: number
  bookings_initiated_30d: number
  bookings_30d: { pending: number; confirmed: number; denied: number; cancelled: number }
  bookings_total: { pending: number; confirmed: number; denied: number; cancelled: number }
  revenue_30d_sek: number
  revenue_total_sek: number
  route_count_30d: number
  route_count_total: number
  conversion_30d: number
}

export type OrganizerDashboardStats = {
  markets: MarketStats[]
  totals: {
    pageviews_30d: number
    pageviews_total: number
    bookings_30d: number
    bookings_total: number
    revenue_30d_sek: number
    revenue_total_sek: number
    route_count_30d: number
    route_count_total: number
    conversion_30d: number
  }
  loading: boolean
  error: string | null
}

export function useOrganizerStats(organizerId: string | undefined): OrganizerDashboardStats {
  const [markets, setMarkets] = useState<MarketStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizerId) return
    setLoading(true)
    setError(null)

    fetchAllStats(organizerId)
      .then(setMarkets)
      .catch((err) => setError(err instanceof Error ? err.message : 'Kunde inte hämta statistik'))
      .finally(() => setLoading(false))
  }, [organizerId])

  const totals = markets.reduce(
    (acc, m) => ({
      pageviews_30d: acc.pageviews_30d + m.pageviews_30d,
      pageviews_total: acc.pageviews_total + m.pageviews_total,
      bookings_30d: acc.bookings_30d + m.bookings_30d.confirmed + m.bookings_30d.pending,
      bookings_total: acc.bookings_total + m.bookings_total.confirmed + m.bookings_total.pending,
      revenue_30d_sek: acc.revenue_30d_sek + m.revenue_30d_sek,
      revenue_total_sek: acc.revenue_total_sek + m.revenue_total_sek,
      route_count_30d: acc.route_count_30d + m.route_count_30d,
      route_count_total: acc.route_count_total + m.route_count_total,
      conversion_30d: 0, // calculated below
    }),
    {
      pageviews_30d: 0, pageviews_total: 0,
      bookings_30d: 0, bookings_total: 0,
      revenue_30d_sek: 0, revenue_total_sek: 0,
      route_count_30d: 0, route_count_total: 0,
      conversion_30d: 0,
    },
  )

  const totalInitiated = markets.reduce((s, m) => s + m.bookings_initiated_30d, 0)
  totals.conversion_30d = totals.pageviews_30d > 0
    ? Math.round((totalInitiated / totals.pageviews_30d) * 100)
    : 0

  return { markets, totals, loading, error }
}

async function fetchAllStats(organizerId: string): Promise<MarketStats[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Du måste vara inloggad')

  // Fetch organizer's markets
  const marketList = await api.fleaMarkets.listByOrganizer(organizerId)

  if (marketList.length === 0) return []

  const marketIds = marketList.map((m) => m.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Parallel: DB stats + PostHog stats
  const [bookings30d, bookingsTotal, routes30d, routesTotal, posthogRes] = await Promise.all([
    fetchBookingStats(marketIds, thirtyDaysAgo),
    fetchBookingStats(marketIds),
    fetchRouteStats(marketIds, thirtyDaysAgo),
    fetchRouteStats(marketIds),
    supabase.functions.invoke('organizer-stats', {
      body: { organizer_id: organizerId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }),
  ])

  const posthogMarkets: PostHogMarketStats[] = posthogRes.data?.markets ?? []

  return marketList.map((market) => {
    const b30 = bookings30d.find((b) => b.flea_market_id === market.id)
    const bTot = bookingsTotal.find((b) => b.flea_market_id === market.id)
    const r30 = routes30d.find((r) => r.flea_market_id === market.id)
    const rTot = routesTotal.find((r) => r.flea_market_id === market.id)
    const ph = posthogMarkets.find((p) => p.flea_market_id === market.id)

    const emptyBookings = { pending: 0, confirmed: 0, denied: 0, cancelled: 0 }

    return {
      flea_market_id: market.id,
      name: market.name,
      pageviews_30d: ph?.pageviews_30d ?? 0,
      pageviews_total: ph?.pageviews_total ?? 0,
      bookings_initiated_30d: ph?.bookings_initiated_30d ?? 0,
      bookings_30d: b30
        ? { pending: b30.pending, confirmed: b30.confirmed, denied: b30.denied, cancelled: b30.cancelled }
        : emptyBookings,
      bookings_total: bTot
        ? { pending: bTot.pending, confirmed: bTot.confirmed, denied: bTot.denied, cancelled: bTot.cancelled }
        : emptyBookings,
      revenue_30d_sek: b30?.revenue_sek ?? 0,
      revenue_total_sek: bTot?.revenue_sek ?? 0,
      route_count_30d: r30?.route_count ?? 0,
      route_count_total: rTot?.route_count ?? 0,
      conversion_30d: ph && ph.pageviews_30d > 0
        ? Math.round((ph.bookings_initiated_30d / ph.pageviews_30d) * 100)
        : 0,
    }
  })
}

async function fetchBookingStats(
  marketIds: string[],
  since?: string,
): Promise<MarketBookingStats[]> {
  let query = supabase
    .from('bookings')
    .select('flea_market_id, status, price_sek, commission_sek')
    .in('flea_market_id', marketIds)

  if (since) {
    query = query.gte('created_at', since)
  }

  const { data } = await query

  if (!data) return []

  // Group by market
  const byMarket = new Map<string, MarketBookingStats>()
  for (const row of data) {
    if (!byMarket.has(row.flea_market_id)) {
      byMarket.set(row.flea_market_id, {
        flea_market_id: row.flea_market_id,
        pending: 0, confirmed: 0, denied: 0, cancelled: 0,
        revenue_sek: 0,
      })
    }
    const stats = byMarket.get(row.flea_market_id)!
    const status = row.status as keyof Pick<MarketBookingStats, 'pending' | 'confirmed' | 'denied' | 'cancelled'>
    if (status in stats) stats[status]++
    if (row.status === 'confirmed') {
      stats.revenue_sek += (row.price_sek ?? 0) - (row.commission_sek ?? 0)
    }
  }

  return [...byMarket.values()]
}

async function fetchRouteStats(
  marketIds: string[],
  since?: string,
): Promise<MarketRouteStats[]> {
  let query = supabase
    .from('route_stops')
    .select('flea_market_id')
    .in('flea_market_id', marketIds)

  if (since) {
    query = query.gte('created_at', since)
  }

  const { data } = await query

  if (!data) return []

  const counts = new Map<string, number>()
  for (const row of data) {
    counts.set(row.flea_market_id, (counts.get(row.flea_market_id) ?? 0) + 1)
  }

  return [...counts.entries()].map(([flea_market_id, route_count]) => ({
    flea_market_id,
    route_count,
  }))
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/use-organizer-stats.ts
git commit -m "feat: add useOrganizerStats hook for dashboard data"
```

---

### Task 5: Build the dashboard page

**Files:**
- Create: `web/src/app/arrangorer/[id]/statistik/page.tsx`

- [ ] **Step 1: Create the statistics page**

Create `web/src/app/arrangorer/[id]/statistik/page.tsx`:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useOrganizerStats } from '@/hooks/use-organizer-stats'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useEffect } from 'react'

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="vintage-card p-5">
      <p className="text-sm text-espresso/60 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-espresso/45 mt-1">Totalt: {subValue}</p>}
    </div>
  )
}

export default function OrganizerStatsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { markets, totals, loading, error } = useOrganizerStats(user?.id === id ? id : undefined)

  useEffect(() => {
    if (!authLoading && (!user || user.id !== id)) {
      router.replace(`/arrangorer/${id}`)
    }
  }, [authLoading, user, id, router])

  if (authLoading || loading) {
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up delay-1">
        <StatCard
          label="Sidvisningar"
          value={totals.pageviews_30d.toLocaleString('sv-SE')}
          subValue={totals.pageviews_total.toLocaleString('sv-SE')}
        />
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

      {/* Conversion */}
      {totals.conversion_30d > 0 && (
        <div className="vintage-card p-5 mb-8 animate-fade-up delay-2">
          <p className="text-sm text-espresso/60 mb-1">Konvertering (besök till bokning)</p>
          <p className="font-display text-2xl font-bold">{totals.conversion_30d}%</p>
        </div>
      )}

      {/* Per-market breakdown */}
      {markets.length > 1 && (
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

- [ ] **Step 2: Verify the app builds**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/arrangorer/[id]/statistik/page.tsx
git commit -m "feat: add organizer statistics dashboard page"
```

---

### Task 6: Add navigation link to the dashboard

**Files:**
- Modify: `web/src/app/arrangorer/[id]/page.tsx`

- [ ] **Step 1: Add the stats link for the organizer viewing their own page**

In `web/src/app/arrangorer/[id]/page.tsx`, the component already has `useAuth` imported. Add a link visible only to the organizer. After the website/markets count `<div>` (around line 83-95), inside the same flex container, add:

```tsx
const { user } = useAuth()
```

This is already available since `useAuth` is imported. After the closing `</div>` of the header card (line ~98), add a link block before the Markets section:

```tsx
{user?.id === id && (
  <div className="mt-4 animate-fade-up delay-1">
    <Link
      href={`/arrangorer/${id}/statistik`}
      className="inline-flex items-center gap-2 vintage-card px-5 py-3 text-sm font-medium text-rust hover:shadow-md transition-all"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-rust">
        <rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="5.5" y="5" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="10" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.8" />
      </svg>
      Visa statistik
    </Link>
  </div>
)}
```

Note: `useAuth` is already used in this component (it's imported at line 6 with `api, OrganizerProfile, FleaMarket`). Check if `user` is already destructured — if not, add it from the existing `useAuth` import. Also ensure `useAuth` is imported from `@/lib/auth-context`.

- [ ] **Step 2: Verify the import**

The file imports `Link` from `next/link` (line 4) and uses `useParams` (line 5). Confirm `useAuth` is imported. If not:

```tsx
import { useAuth } from '@/lib/auth-context'
```

- [ ] **Step 3: Verify the app builds**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/app/arrangorer/[id]/page.tsx
git commit -m "feat: add statistics link on organizer profile page"
```

---

### Task 7: Set up PostHog secrets for the edge function

**Files:** None (Supabase configuration only)

- [ ] **Step 1: Document required secrets in SETUP-CHECKLIST.txt**

Add to `SETUP-CHECKLIST.txt`:

```
## PostHog Analytics (organizer-stats edge function)
- [ ] Set POSTHOG_PRIVATE_API_KEY: supabase secrets set POSTHOG_PRIVATE_API_KEY=phx_...
- [ ] Set POSTHOG_PROJECT_ID: supabase secrets set POSTHOG_PROJECT_ID=12345
- [ ] Set POSTHOG_HOST: supabase secrets set POSTHOG_HOST=https://eu.i.posthog.com
      (defaults to https://eu.i.posthog.com if not set)
```

- [ ] **Step 2: Commit**

```bash
git add SETUP-CHECKLIST.txt
git commit -m "docs: add PostHog secrets to setup checklist"
```
