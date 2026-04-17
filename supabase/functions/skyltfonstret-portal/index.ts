import { createHandler, HttpError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, origin }) => {
  // Validate origin against allowed origins
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim())
  const safeOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || origin

  // Get user profile
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) throw new HttpError(400, 'Profile not found')

  if (!profile.stripe_customer_id) {
    throw new HttpError(400, 'No subscription found')
  }

  if (profile.subscription_tier < 1) {
    throw new HttpError(400, 'No active subscription')
  }

  // Create Billing Portal Session
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${safeOrigin}/profile/edit`,
  })

  return { url: session.url }
})
