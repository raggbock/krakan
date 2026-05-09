/**
 * Supabase adapter for StatsPort — production implementation.
 *
 * Calls Supabase RPCs (`organizer_booking_stats`, `organizer_route_stats`)
 * that aggregate in SQL — no raw booking/route rows are transferred.
 * The optional `since` date is forwarded to the RPC as `p_since`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  StatsPort,
  OrganizerBookingStatsRow,
  OrganizerRouteStatsRow,
} from '../../ports/stats'

export function createSupabaseStats(supabase: SupabaseClient): StatsPort {
  return {
    async organizerBookingStats(organizerId, since) {
      const params: { p_organizer_id: string; p_since?: string } = { p_organizer_id: organizerId }
      if (since !== undefined) params.p_since = since
      const { data, error } = await supabase.rpc('organizer_booking_stats', params)
      if (error) throw error
      return (data ?? []) as OrganizerBookingStatsRow[]
    },

    async organizerRouteStats(organizerId, since) {
      const params: { p_organizer_id: string; p_since?: string } = { p_organizer_id: organizerId }
      if (since !== undefined) params.p_since = since
      const { data, error } = await supabase.rpc('organizer_route_stats', params)
      if (error) throw error
      return (data ?? []) as OrganizerRouteStatsRow[]
    },
  }
}
