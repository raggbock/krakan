/**
 * FollowRepository — port for managing user follow relationships.
 *
 * Issue #151 added market follows. Issue #152 adds city follows.
 *
 * All methods are idempotent:
 *   - follow*: upsert — no error if already following
 *   - unfollow*: delete — no error if not following
 */
export interface FollowRepository {
  // ─── Market follows ──────────────────────────────────────────────────────

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

  // ─── City follows ─────────────────────────────────────────────────────────

  /**
   * Follow a city by slug. Idempotent (upsert) — safe to call if already following.
   */
  followCity(userId: string, citySlug: string): Promise<void>

  /**
   * Unfollow a city by slug. Idempotent — safe to call if not following.
   */
  unfollowCity(userId: string, citySlug: string): Promise<void>

  /**
   * Returns true if the user is currently following the city.
   */
  isFollowingCity(userId: string, citySlug: string): Promise<boolean>
}
