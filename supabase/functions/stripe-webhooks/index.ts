import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { stripe } from '../_shared/stripe.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'
import { createSupabaseBookingRepo } from '@fyndstigen/shared/adapters/supabase/booking-repo'
import type { BookingEvent } from '@fyndstigen/shared/booking-lifecycle'

// Verify webhook signature, route to BookingRepo.applyEvent.
// Non-booking events (account.updated, checkout, subscription) stay inline.

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
      const repo = createSupabaseBookingRepo(admin)
      const booking = await repo.findByPaymentIntent(pi.id)
      if (!booking) break
      const bookingEvent: BookingEvent = { type: 'stripe.payment_intent.canceled' }
      const { error } = await applyEventRaw(admin, booking.id, bookingEvent)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      const repo = createSupabaseBookingRepo(admin)
      const booking = await repo.findByPaymentIntent(pi.id)
      if (!booking) break
      const bookingEvent: BookingEvent = { type: 'stripe.payment_intent.failed' }
      const { error } = await applyEventRaw(admin, booking.id, bookingEvent)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object
      const repo = createSupabaseBookingRepo(admin)
      const booking = await repo.findByPaymentIntent(pi.id)
      if (!booking) break

      // Fetch market to learn auto_accept — same query as original webhook handler
      const { data: market } = await admin
        .from('flea_markets')
        .select('auto_accept_bookings')
        .eq('id', booking.flea_market_id)
        .single()

      const bookingEvent: BookingEvent = {
        type: 'stripe.payment_intent.succeeded',
        autoAccept: !!market?.auto_accept_bookings,
      }
      const { error } = await applyEventRaw(admin, booking.id, bookingEvent)
      if (error) return new Response('DB error', { status: 500 })
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

// ---------------------------------------------------------------------------
// Internal helper: applies a lifecycle event using the raw Supabase admin
// client.  We use repo.applyEvent but surface DB errors as a return value
// (not a thrown exception) to preserve the original webhook error-response
// shape (return new Response('DB error', { status: 500 })).
// ---------------------------------------------------------------------------
async function applyEventRaw(
  admin: ReturnType<typeof getSupabaseAdmin>,
  bookingId: string,
  event: BookingEvent,
): Promise<{ error: unknown }> {
  try {
    const repo = createSupabaseBookingRepo(admin)
    await repo.applyEvent(bookingId, event)
    return { error: null }
  } catch (err) {
    return { error: err }
  }
}
