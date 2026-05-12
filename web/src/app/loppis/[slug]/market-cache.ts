/**
 * Request-scoped cache helpers for /loppis/[slug].
 *
 * Both layout.tsx and page.tsx import from here so they share
 * the same React cache() instances — one DB round-trip per slug
 * per request, regardless of how many Server Components call these.
 */
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  createSupabaseServerData,
  createSupabaseFleaMarkets,
  createSupabaseMarketTables,
} from '@fyndstigen/shared'
import type { FleaMarketDetailsView, MarketTableView } from '@fyndstigen/shared'

export type MarketDetailData = {
  id: string
  market: FleaMarketDetailsView
  tables: MarketTableView[]
}

/**
 * Resolves slug → FleaMarketDetailsView + tables.
 * Returns null if the market does not exist (caller should notFound()).
 * React cache() dedupes calls within a single request.
 */
export const resolveMarketDetails = cache(async (slug: string): Promise<MarketDetailData | null> => {
  // CI / build environments without a real Supabase URL would otherwise
  // hang ~30s on each /loppis/[slug] render waiting for fetch to fail.
  // Bail fast so page.tsx 404s and the build proceeds.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || url.includes('placeholder.supabase.co')) return null

  const supabase = await createSupabaseServerClient()
  const server = createSupabaseServerData(supabase)
  const id = await server.getMarketIdBySlug(slug)
  if (!id) return null

  const fleaMarkets = createSupabaseFleaMarkets(supabase)
  const marketTables = createSupabaseMarketTables(supabase)

  const [market, tables] = await Promise.all([
    fleaMarkets.details(id),
    marketTables.list(id),
  ])

  return { id, market, tables }
})
