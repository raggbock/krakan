/**
 * Supabase adapters for ProfileRepository and OrganizerRepository —
 * production implementations.
 *
 * `OrganizerRepository.stats()` calls the `organizer_stats` Supabase RPC
 * which aggregates market + booking counts in SQL (no raw rows transferred).
 *
 * All methods throw on Supabase errors.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfileView, OrganizerProfileView, OrganizerStats } from '../../types'
import type { ProfileRow, OrganizerProfileRow } from '../../types/db'
import type { ProfileRepository, OrganizerRepository } from '../../ports/profiles'

function rowToUserProfileView(row: ProfileRow): UserProfileView {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
    userType: row.user_type,
  }
}

function rowToOrganizerProfileView(row: OrganizerProfileRow): OrganizerProfileView {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
    userType: row.user_type,
    bio: row.bio,
    website: row.website,
    logoPath: row.logo_path,
    subscriptionTier: row.subscription_tier,
  }
}

export function createSupabaseProfiles(supabase: SupabaseClient): ProfileRepository {
  return {
    async get(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return rowToUserProfileView(data as ProfileRow)
    },

    async update(userId, updates) {
      const row: Partial<ProfileRow> = {}
      if ('firstName' in updates) row.first_name = updates.firstName
      if ('lastName' in updates) row.last_name = updates.lastName
      if ('phoneNumber' in updates) row.phone_number = updates.phoneNumber
      if ('userType' in updates) row.user_type = updates.userType
      const { error } = await supabase
        .from('profiles')
        .update(row)
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
      return rowToOrganizerProfileView(data as OrganizerProfileRow)
    },

    async update(userId, updates) {
      const row: Partial<OrganizerProfileRow> = {}
      if ('firstName' in updates) row.first_name = updates.firstName
      if ('lastName' in updates) row.last_name = updates.lastName
      if ('phoneNumber' in updates) row.phone_number = updates.phoneNumber
      if ('bio' in updates) row.bio = updates.bio
      if ('website' in updates) row.website = updates.website
      const { error } = await supabase
        .from('profiles')
        .update(row)
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
