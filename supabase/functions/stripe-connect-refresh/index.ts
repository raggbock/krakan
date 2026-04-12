import { createHandler, NotFoundError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, origin }) => {
  const { data, error } = await admin
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('organizer_id', user.id)
    .single()

  if (error || !data) throw new NotFoundError('No Stripe account found')

  const accountLink = await stripe.accountLinks.create({
    account: data.stripe_account_id,
    refresh_url: `${origin}/profile?stripe=refresh`,
    return_url: `${origin}/profile?stripe=complete`,
    type: 'account_onboarding',
  })

  return { url: accountLink.url }
})
