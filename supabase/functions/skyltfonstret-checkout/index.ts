import { createHandler, HttpError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, body, origin }) => {
  const priceId = Deno.env.get('SKYLTFONSTRET_PRICE_ID')
  if (!priceId) throw new Error('SKYLTFONSTRET_PRICE_ID is not set')

  // Get user profile
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) throw new HttpError(400, 'Profile not found')

  // Check if already premium
  const { data: tierCheck } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (tierCheck && tierCheck.subscription_tier >= 1) {
    throw new HttpError(400, 'Already subscribed to Skyltfönstret')
  }

  // Create or reuse Stripe Customer
  let customerId = profile.stripe_customer_id

  if (!customerId) {
    const { data: { user: authUser } } = await admin.auth.admin.getUserById(user.id)
    const email = authUser?.email

    const customer = await stripe.customers.create({
      email: email || undefined,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id

    const { error: updateErr } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)

    if (updateErr) throw new Error('Failed to save Stripe customer ID')
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/profile/edit?skyltfonstret=active`,
    cancel_url: `${origin}/profile/edit`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  })

  if (!session.url) throw new Error('Failed to create checkout session')

  return { url: session.url }
})
