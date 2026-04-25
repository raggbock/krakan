/**
 * StatsPort — DB-side aggregation queries for the organizer dashboard.
 *
 * The supabase adapter calls existing PostgREST RPCs that aggregate in SQL
 * (no raw rows transferred). Optional `since` date filters to the last
 * N days; omit for the all-time totals.
 */

export type OrganizerBookingStatsRow = {
  flea_market_id: string
  status: 'pending' | 'confirmed' | 'denied' | 'cancelled'
  booking_count: number
  revenue_sek: number
}

export type OrganizerRouteStatsRow = {
  flea_market_id: string
  route_count: number
}

export interface StatsPort {
  /** One row per (market × booking status) for the organizer's markets. */
  organizerBookingStats(organizerId: string, since?: string): Promise<OrganizerBookingStatsRow[]>
  /** One row per market for the organizer's markets. */
  organizerRouteStats(organizerId: string, since?: string): Promise<OrganizerRouteStatsRow[]>
}
