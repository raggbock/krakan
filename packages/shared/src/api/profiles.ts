import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile, OrganizerProfile, OrganizerStats } from '../types'

export function createProfilesApi(supabase: SupabaseClient) {
  return {
    profiles: {
      get: async (userId: string) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error) throw error
        return data as UserProfile
      },

      update: async (userId: string, updates: Partial<UserProfile>) => {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
        if (error) throw error
      },
    },

    organizers: {
      get: async (userId: string) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error) throw error
        return data as OrganizerProfile
      },

      update: async (
        userId: string,
        updates: Partial<Pick<OrganizerProfile, 'bio' | 'website' | 'first_name' | 'last_name' | 'phone_number'>>,
      ) => {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
        if (error) throw error
      },

      stats: async (userId: string) => {
        const { data, error } = await supabase
          .rpc('organizer_stats_for', { p_organizer_id: userId })
          .single()
        if (error && error.code !== 'PGRST116') throw error
        return (data ?? {
          organizer_id: userId,
          market_count: 0,
          total_bookings: 0,
          total_revenue_sek: 0,
          total_commission_sek: 0,
        }) as OrganizerStats
      },
    },
  }
}
