/**
 * In-memory adapter for FollowRepository — for use in tests and E2E.
 *
 * Each store is a Set of composite keys so lookups are O(1) and
 * double-follow / missing-unfollow are naturally idempotent.
 */
import type { FollowRepository } from '../../ports/follow-repo'

export function createInMemoryFollowRepo(): FollowRepository {
  const marketStore = new Set<string>()
  const cityStore = new Set<string>()

  function marketKey(userId: string, marketId: string): string {
    return `${userId}::${marketId}`
  }

  function cityKey(userId: string, citySlug: string): string {
    return `${userId}::${citySlug}`
  }

  return {
    async followMarket(userId, marketId) {
      marketStore.add(marketKey(userId, marketId))
    },

    async unfollowMarket(userId, marketId) {
      marketStore.delete(marketKey(userId, marketId))
    },

    async isFollowingMarket(userId, marketId) {
      return marketStore.has(marketKey(userId, marketId))
    },

    async followCity(userId, citySlug) {
      cityStore.add(cityKey(userId, citySlug))
    },

    async unfollowCity(userId, citySlug) {
      cityStore.delete(cityKey(userId, citySlug))
    },

    async isFollowingCity(userId, citySlug) {
      return cityStore.has(cityKey(userId, citySlug))
    },
  }
}
