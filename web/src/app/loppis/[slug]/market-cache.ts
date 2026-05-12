/**
 * Request-scoped cache helper for /loppis/[slug].
 *
 * Both layout.tsx and page.tsx import `resolveLoppis` from here so they share
 * the same React cache() instance — one DB round-trip sequence per slug per
 * request, regardless of how many Server Components call this function.
 *
 * Round-trips per render:
 *   1. slug → id  (getMarketIdBySlug)
 *   2. details(id) + tables.list(id)  [parallel Promise.all — one network RTT]
 *   Total: 2 network RTTs / 3 Supabase calls (down from 3 RTTs / 5–6 calls)
 *
 * Meta fields (organizer_subscription_tier, price_range, image_url) are derived
 * from the already-fetched `market` and `tables` — no extra round-trip needed.
 */
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  createSupabaseServerData,
  createSupabaseFleaMarkets,
  createSupabaseMarketTables,
} from '@fyndstigen/shared'
import type { FleaMarketDetailsView, MarketTableView } from '@fyndstigen/shared'

export type LoppisData = {
  id: string
  market: FleaMarketDetailsView
  tables: MarketTableView[]
  meta: {
    /** Organizer subscription tier — 0 = free, 1+ = paid. Drives title/description branching. */
    organizer_subscription_tier: number
    /** Price range derived from available tables. Null when no tables exist. */
    price_range: { min_sek: number; max_sek: number } | null
    /** Public URL for the first market image, or null. Used as OG image. */
    image_url: string | null
  }
}

/**
 * Resolves slug → full LoppisData (market details, tables, derived metadata).
 * Returns null if the market does not exist (caller should notFound()).
 * React cache() dedupes calls within a single request.
 */
export const resolveLoppis = cache(async (slug: string): Promise<LoppisData | null> => {
  // CI / build environments without a real Supabase URL would otherwise
  // hang ~30s on each /loppis/[slug] render waiting for fetch to fail.
  // Bail fast so page.tsx 404s and the build proceeds.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || url.includes('placeholder.supabase.co')) return null

  const supabase = await createSupabaseServerClient()
  const server = createSupabaseServerData(supabase)

  // Round-trip 1: slug → id
  const id = await server.getMarketIdBySlug(slug)
  if (!id) return null

  const fleaMarkets = createSupabaseFleaMarkets(supabase)
  const marketTables = createSupabaseMarketTables(supabase)

  // Round-trip 2: details + tables in parallel (single network RTT)
  const [market, tables] = await Promise.all([
    fleaMarkets.details(id),
    marketTables.list(id),
  ])

  if (!market) return null

  // Derive meta from already-fetched data — no extra round-trips.
  const organizer_subscription_tier = market.organizerSubscriptionTier

  const price_range = tables.length > 0
    ? {
        min_sek: Math.min(...tables.map((t) => t.priceSek)),
        max_sek: Math.max(...tables.map((t) => t.priceSek)),
      }
    : null

  const supabaseUrl = url
  const firstImage = [...market.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  const image_url = firstImage
    ? `${supabaseUrl}/storage/v1/object/public/flea-market-images/${firstImage.storagePath}`
    : null

  return {
    id,
    market,
    tables,
    meta: { organizer_subscription_tier, price_range, image_url },
  }
})
