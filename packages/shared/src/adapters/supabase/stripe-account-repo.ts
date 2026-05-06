/**
 * Supabase adapter for StripeAccountRepo.
 *
 * Updates the onboarding_complete flag in the stripe_accounts table.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StripeAccountRepo } from '../../ports/stripe-account-repo'

export function createSupabaseStripeAccountRepo(admin: SupabaseClient): StripeAccountRepo {
  return {
    async setOnboardingComplete(stripeAccountId, complete) {
      const { error } = await admin
        .from('stripe_accounts')
        .update({ onboarding_complete: complete })
        .eq('stripe_account_id', stripeAccountId)
      if (error) throw new Error(`Failed to update stripe account ${stripeAccountId}: ${error.message}`)
    },
  }
}
