import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile, OrganizerProfile, OrganizerStats } from '../../types'
import type { ProfileRepository, OrganizerRepository } from '../../ports/profiles'

export function createSupabaseProfiles(supabase: SupabaseClient): ProfileRepository {
  return {
    async get(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as UserProfile
    },

    async update(userId, updates) {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
      if (error) throw error
    },
  }
}

export function createSupabaseOrganizers(supabase: SupabaseClient): OrganizerRepository {
  return {
    async get(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as OrganizerProfile
    },

    async update(userId, updates) {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
      if (error) throw error
    },

    async stats(userId) {
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
  }
}
