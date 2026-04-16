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
      conversion_30d: 0,
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

  const marketList = await api.fleaMarkets.listByOrganizer(organizerId)
  if (marketList.length === 0) return []

  const marketIds = marketList.map((m) => m.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

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
