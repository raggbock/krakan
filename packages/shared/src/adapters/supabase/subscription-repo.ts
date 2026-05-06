/**
 * Supabase adapter for SubscriptionRepo.
 *
 * Updates subscription_tier on the profiles table, keyed by user ID or
 * Stripe customer ID.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SubscriptionRepo } from '../../ports/subscription-repo'

export function createSupabaseSubscriptionRepo(admin: SupabaseClient): SubscriptionRepo {
  return {
    async setTierByUserId(userId, tier) {
      const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('id', userId)
      if (error) throw new Error(`Failed to set tier for user ${userId}: ${error.message}`)
    },

    async setTierByCustomerId(customerId, tier) {
      const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('stripe_customer_id', customerId)
      if (error) throw new Error(`Failed to set tier for customer ${customerId}: ${error.message}`)
    },
  }
}
