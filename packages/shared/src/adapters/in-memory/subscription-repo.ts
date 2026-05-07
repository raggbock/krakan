/**
 * In-memory adapter for SubscriptionRepo — for use in tests.
 */
import type { SubscriptionRepo } from '../../ports/subscription-repo'

export interface InMemorySubscriptionRepo extends SubscriptionRepo {
  /** Test helper: get the tier stored for a given user ID */
  _getTierByUserId(userId: string): 0 | 1 | undefined
  /** Test helper: get the tier stored for a given customer ID */
  _getTierByCustomerId(customerId: string): 0 | 1 | undefined
}

export function createInMemorySubscriptionRepo(): InMemorySubscriptionRepo {
  const byUser = new Map<string, 0 | 1>()
  const byCustomer = new Map<string, 0 | 1>()

  return {
    async setTierByUserId(userId, tier) {
      byUser.set(userId, tier)
    },

    async setTierByCustomerId(customerId, tier) {
      byCustomer.set(customerId, tier)
    },

    _getTierByUserId(userId) {
      return byUser.get(userId)
    },

    _getTierByCustomerId(customerId) {
      return byCustomer.get(customerId)
    },
  }
}
