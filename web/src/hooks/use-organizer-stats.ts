'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type RpcBookingRow = {
  flea_market_id: string
  status: string
  booking_count: number
  revenue_sek: number
}

type RpcRouteRow = {
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // All aggregation happens in SQL via RPC — no raw rows transferred
  const [bookings30d, bookingsTotal, routes30d, routesTotal, posthogRes] = await Promise.all([
    supabase.rpc('organizer_booking_stats', { p_organizer_id: organizerId, p_since: thirtyDaysAgo }),
    supabase.rpc('organizer_booking_stats', { p_organizer_id: organizerId }),
    supabase.rpc('organizer_route_stats', { p_organizer_id: organizerId, p_since: thirtyDaysAgo }),
    supabase.rpc('organizer_route_stats', { p_organizer_id: organizerId }),
    api.endpoints['organizer.stats']
      .invoke({ organizer_id: organizerId })
      .catch(() => ({ markets: [] as PostHogMarketStats[] })),
  ])

  const bookingRows30d: RpcBookingRow[] = bookings30d.data ?? []
  const bookingRowsTotal: RpcBookingRow[] = bookingsTotal.data ?? []
  const routeRows30d: RpcRouteRow[] = routes30d.data ?? []
  const routeRowsTotal: RpcRouteRow[] = routesTotal.data ?? []
  const posthogMarkets: PostHogMarketStats[] = posthogRes?.markets ?? []

  return marketList.map((market) => {
    const b30 = groupBookingRows(bookingRows30d, market.id)
    const bTot = groupBookingRows(bookingRowsTotal, market.id)
    const r30 = routeRows30d.find((r) => r.flea_market_id === market.id)
    const rTot = routeRowsTotal.find((r) => r.flea_market_id === market.id)
    const ph = posthogMarkets.find((p) => p.flea_market_id === market.id)

    return {
      flea_market_id: market.id,
      name: market.name,
      pageviews_30d: ph?.pageviews_30d ?? 0,
      pageviews_total: ph?.pageviews_total ?? 0,
      bookings_initiated_30d: ph?.bookings_initiated_30d ?? 0,
      bookings_30d: b30.counts,
      bookings_total: bTot.counts,
      revenue_30d_sek: b30.revenue,
      revenue_total_sek: bTot.revenue,
      route_count_30d: r30?.route_count ?? 0,
      route_count_total: rTot?.route_count ?? 0,
      conversion_30d: ph && ph.pageviews_30d > 0
        ? Math.round((ph.bookings_initiated_30d / ph.pageviews_30d) * 100)
        : 0,
    }
  })
}

function groupBookingRows(rows: RpcBookingRow[], marketId: string) {
  const counts = { pending: 0, confirmed: 0, denied: 0, cancelled: 0 }
  let revenue = 0
  for (const row of rows) {
    if (row.flea_market_id !== marketId) continue
    const status = row.status as keyof typeof counts
    if (status in counts) counts[status] = row.booking_count
    if (row.status === 'confirmed') revenue = row.revenue_sek
  }
  return { counts, revenue }
}
