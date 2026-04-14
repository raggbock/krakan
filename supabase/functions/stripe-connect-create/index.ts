import { createHandler } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, origin }) => {
  // Check if account already exists
  const { data: existing } = await admin
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete')
    .eq('organizer_id', user.id)
    .single()

  let stripeAccountId: string

  if (existing) {
    stripeAccountId = existing.stripe_account_id
  } else {
    const account = await stripe.accounts.create({
      type: 'standard',
      country: 'SE',
      email: user.email,
      metadata: { organizer_id: user.id },
    })
    stripeAccountId = account.id

    const { error: insertErr } = await admin
      .from('stripe_accounts')
      .insert({
        organizer_id: user.id,
        stripe_account_id: account.id,
      })
    if (insertErr) throw insertErr
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${origin}/profile?stripe=refresh`,
    return_url: `${origin}/profile?stripe=complete`,
    type: 'account_onboarding',
  })

  return { url: accountLink.url }
})
