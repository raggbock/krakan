/**
 * FollowRepository — port for managing user follow relationships.
 *
 * This tracer slice (issue #151) covers market follows only.
 * City follows (issue #152) will extend this interface.
 *
 * All methods are idempotent:
 *   - followMarket: upsert — no error if already following
 *   - unfollowMarket: delete — no error if not following
 */
export interface FollowRepository {
  /**
   * Follow a market. Idempotent (upsert) — safe to call if already following.
   */
  followMarket(userId: string, marketId: string): Promise<void>

  /**
   * Unfollow a market. Idempotent — safe to call if not following.
   */
  unfollowMarket(userId: string, marketId: string): Promise<void>

  /**
   * Returns true if the user is currently following the market.
   */
  isFollowingMarket(userId: string, marketId: string): Promise<boolean>
}
