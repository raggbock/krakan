import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { stripe } from '../_shared/stripe.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'
import { applyBookingEvent, type BookingEvent } from '@fyndstigen/shared/booking-lifecycle'

// Apply a lifecycle event to a booking identified by its Stripe PaymentIntent.
// Returns a Response on DB error, undefined on success / not-found (idempotent).
async function applyEventByPaymentIntent(
  admin: ReturnType<typeof getSupabaseAdmin>,
  paymentIntentId: string,
  build: (booking: { status: 'pending' | 'confirmed' | 'denied' | 'cancelled'; flea_market_id: string }) => Promise<BookingEvent> | BookingEvent,
): Promise<Response | undefined> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, stripe_payment_intent_id, flea_market_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()
  if (!booking) return

  const event = await build(booking)
  const patch = applyBookingEvent(booking, event)
  if (Object.keys(patch).length === 0) return

  const { error } = await admin.from('bookings').update(patch).eq('id', booking.id)
  if (error) return new Response('DB error', { status: 500 })
}

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()
  let event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object
      const onboardingComplete = !!(account.charges_enabled && account.details_submitted)
      const { error } = await admin
        .from('stripe_accounts')
        .update({ onboarding_complete: onboardingComplete })
        .eq('stripe_account_id', account.id)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object
      const errResp = await applyEventByPaymentIntent(admin, pi.id, () => ({ type: 'stripe.payment_intent.canceled' }))
      if (errResp) return errResp
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      const errResp = await applyEventByPaymentIntent(admin, pi.id, () => ({ type: 'stripe.payment_intent.failed' }))
      if (errResp) return errResp
      break
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object
      const errResp = await applyEventByPaymentIntent(admin, pi.id, async (booking) => {
        const { data: market } = await admin
          .from('flea_markets')
          .select('auto_accept_bookings')
          .eq('id', booking.flea_market_id)
          .single()
        return { type: 'stripe.payment_intent.succeeded', autoAccept: !!market?.auto_accept_bookings }
      })
      if (errResp) return errResp
      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object
      // Only handle subscription checkouts
      if (session.mode !== 'subscription') break

      // Get user_id from metadata
      const userId = session.metadata?.user_id

      if (!userId) {
        // Fallback: find user by Stripe Customer ID
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : null
        if (!customerId) {
          console.warn(`checkout.session.completed: no user_id or customer_id found for session ${session.id}`)
          break
        }
        {
          const { error } = await admin
            .from('profiles')
            .update({ subscription_tier: 1 })
            .eq('stripe_customer_id', customerId)
          if (error) return new Response('DB error', { status: 500 })
        }
        break
      }

      const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: 1 })
        .eq('id', userId)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : null

      if (!customerId) break

      // Downgrade: set subscription_tier back to 0
      const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: 0 })
        .eq('stripe_customer_id', customerId)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'invoice.payment_failed': {
      // Log for now — Stripe retries automatically
      const invoice = event.data.object
      console.warn(`Invoice payment failed: ${invoice.id}, customer: ${invoice.customer}`)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
