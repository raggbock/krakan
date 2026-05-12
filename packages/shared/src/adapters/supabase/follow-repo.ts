/**
 * Supabase adapter for FollowRepository.
 *
 * follow* uses INSERT … ON CONFLICT DO NOTHING (upsert) for idempotency.
 * unfollow* uses DELETE without an error-on-zero-rows check so
 * deleting a non-existent follow is silently a no-op.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FollowRepository } from '../../ports/follow-repo'

export function createSupabaseFollowRepo(supabase: SupabaseClient): FollowRepository {
  return {
    // ─── Market follows ────────────────────────────────────────────────────

    async followMarket(userId, marketId) {
      const { error } = await supabase
        .from('user_market_follows')
        .upsert(
          { user_id: userId, flea_market_id: marketId },
          { onConflict: 'user_id,flea_market_id' },
        )
      if (error) throw new Error(`Failed to follow market ${marketId}: ${error.message}`)
    },

    async unfollowMarket(userId, marketId) {
      const { error } = await supabase
        .from('user_market_follows')
        .delete()
        .eq('user_id', userId)
        .eq('flea_market_id', marketId)
      if (error) throw new Error(`Failed to unfollow market ${marketId}: ${error.message}`)
    },

    async isFollowingMarket(userId, marketId) {
      const { data, error } = await supabase
        .from('user_market_follows')
        .select('user_id')
        .eq('user_id', userId)
        .eq('flea_market_id', marketId)
        .maybeSingle()
      if (error) throw new Error(`Failed to check follow for market ${marketId}: ${error.message}`)
      return data !== null
    },

    // ─── City follows ──────────────────────────────────────────────────────

    async followCity(userId, citySlug) {
      const { error } = await supabase
        .from('user_city_follows')
        .upsert(
          { user_id: userId, city_slug: citySlug },
          { onConflict: 'user_id,city_slug' },
        )
      if (error) throw new Error(`Failed to follow city ${citySlug}: ${error.message}`)
    },

    async unfollowCity(userId, citySlug) {
      const { error } = await supabase
        .from('user_city_follows')
        .delete()
        .eq('user_id', userId)
        .eq('city_slug', citySlug)
      if (error) throw new Error(`Failed to unfollow city ${citySlug}: ${error.message}`)
    },

    async isFollowingCity(userId, citySlug) {
      const { data, error } = await supabase
        .from('user_city_follows')
        .select('user_id')
        .eq('user_id', userId)
        .eq('city_slug', citySlug)
        .maybeSingle()
      if (error) throw new Error(`Failed to check follow for city ${citySlug}: ${error.message}`)
      return data !== null
    },
  }
}
