/**
 * In-memory adapter for FollowRepository — for use in tests and E2E.
 *
 * The store is a Set of composite keys (`${userId}::${marketId}`) so
 * lookups are O(1) and double-follow / missing-unfollow are naturally
 * idempotent.
 */
import type { FollowRepository } from '../../ports/follow-repo'

export function createInMemoryFollowRepo(): FollowRepository {
  const store = new Set<string>()

  function key(userId: string, marketId: string): string {
    return `${userId}::${marketId}`
  }

  return {
    async followMarket(userId, marketId) {
      store.add(key(userId, marketId))
    },

    async unfollowMarket(userId, marketId) {
      store.delete(key(userId, marketId))
    },

    async isFollowingMarket(userId, marketId) {
      return store.has(key(userId, marketId))
    },
  }
}
