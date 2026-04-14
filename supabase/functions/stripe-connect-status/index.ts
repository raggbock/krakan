import { createHandler } from '../_shared/handler.ts'

createHandler(async ({ user, admin }) => {
  const { data } = await admin
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('organizer_id', user.id)
    .single()

  return {
    connected: !!data,
    onboarding_complete: data?.onboarding_complete ?? false,
  }
})
