import { defineEndpoint } from '../_shared/endpoint.ts'
import { StripeConnectStatusInput, StripeConnectStatusOutput } from '@fyndstigen/shared/contracts/stripe-connect-status.ts'

defineEndpoint({
  name: 'stripe-connect-status',
  input: StripeConnectStatusInput,
  output: StripeConnectStatusOutput,
  handler: async ({ user, admin }) => {
    const { data } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', user.id)
      .single()

    return {
      connected: !!data,
      onboarding_complete: data?.onboarding_complete ?? false,
    }
  },
})
