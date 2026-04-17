import { createHandler, HttpError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

createHandler(async ({ user, admin, origin, req }) => {
  const priceId = Deno.env.get('SKYLTFONSTRET_PRICE_ID')
  if (!priceId) throw new Error('SKYLTFONSTRET_PRICE_ID is not set')

  // Validate origin against allowed origins to prevent redirect hijacking
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim())
  const safeOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || origin

  // Get user profile (single query for all needed fields)
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id, first_name, last_name, subscription_tier')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) throw new HttpError(400, 'Profile not found')

  if (profile.subscription_tier >= 1) {
    throw new HttpError(400, 'Already subscribed to Skyltfönstret')
  }

  // Create or reuse Stripe Customer
  let customerId = profile.stripe_customer_id

  if (!customerId) {
    // Look up user email safely
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(user.id)
    if (authErr || !authData?.user) throw new Error('Failed to look up user account')
    const email = authData.user.email

    const customer = await stripe.customers.create(
      {
        email: email || undefined,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined,
        metadata: { user_id: user.id },
      },
      { idempotencyKey: `customer-create-${user.id}` },
    )
    customerId = customer.id

    // Conditional update — only write if stripe_customer_id is still null (race guard)
    const { data: updated } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .single()

    // If another request won the race, use their customer ID
    if (!updated) {
      const { data: existing } = await admin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()
      customerId = existing?.stripe_customer_id ?? customerId
    }
  }

  // Check Stripe for existing active subscription (prevents double billing)
  const existingSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  })
  if (existingSubs.data.length > 0) {
    throw new HttpError(400, 'Already subscribed to Skyltfönstret')
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${safeOrigin}/profile/edit?skyltfonstret=active`,
    cancel_url: `${safeOrigin}/profile/edit`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  })

  if (!session.url) throw new Error('Failed to create checkout session')

  return { url: session.url }
})
