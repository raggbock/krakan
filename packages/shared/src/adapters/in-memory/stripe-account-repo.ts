/**
 * In-memory adapter for StripeAccountRepo — for use in tests.
 */
import type { StripeAccountRepo } from '../../ports/stripe-account-repo'

export interface InMemoryStripeAccountRepo extends StripeAccountRepo {
  /** Test helper: get the stored onboarding state for an account */
  _getState(stripeAccountId: string): { complete: boolean } | undefined
}

export function createInMemoryStripeAccountRepo(): InMemoryStripeAccountRepo {
  const store = new Map<string, { complete: boolean }>()

  return {
    async setOnboardingComplete(stripeAccountId, complete) {
      store.set(stripeAccountId, { complete })
    },

    _getState(stripeAccountId) {
      return store.get(stripeAccountId)
    },
  }
}
