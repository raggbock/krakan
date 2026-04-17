import { createHandler, HttpError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, origin }) => {
  // Get user profile
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) throw new HttpError(400, 'Profile not found')

  if (!profile.stripe_customer_id) {
    throw new HttpError(400, 'No active subscription found')
  }

  // Create Billing Portal Session
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/profile/edit`,
  })

  return { url: session.url }
})
