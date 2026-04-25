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
