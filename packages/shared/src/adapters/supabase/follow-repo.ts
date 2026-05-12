/**
 * Supabase adapter for FollowRepository.
 *
 * followMarket uses INSERT … ON CONFLICT DO NOTHING for idempotency.
 * unfollowMarket uses DELETE without an error-on-zero-rows check so
 * deleting a non-existent follow is silently a no-op.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FollowRepository } from '../../ports/follow-repo'

export function createSupabaseFollowRepo(supabase: SupabaseClient): FollowRepository {
  return {
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
  }
}
