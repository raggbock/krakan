/**
 * Stripe webhook pure reducer.
 *
 * Maps a Stripe.Event + pre-fetched lookups into a list of domain commands.
 * Zero I/O — deterministic, synchronous, unit-testable without Stripe SDK
 * runtime, Supabase, or Deno.
 *
 * Deno edge functions import this file directly via the import map in
 * supabase/functions/deno.json.
 */

import type Stripe from 'stripe' // type-only — no runtime dep

// ---------------------------------------------------------------------------
// Command union
// ---------------------------------------------------------------------------

export type WebhookCommand =
  | { type: 'booking.markPaid'; bookingId: string; autoAccept: boolean; paymentIntentId: string }
  | { type: 'booking.markPaymentFailed'; bookingId: string; reason: string }
  | { type: 'booking.markCanceled'; bookingId: string }
  | { type: 'account.setOnboarding'; stripeAccountId: string; complete: boolean; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { type: 'subscription.setTier'; lookup: { userId: string } | { customerId: string }; tier: 0 | 1; subscriptionId?: string }
  | { type: 'log.warn'; msg: string; context?: Record<string, unknown> }
  | { type: 'log.info'; msg: string; context?: Record<string, unknown> }
  | { type: 'noop'; reason: string }

// ---------------------------------------------------------------------------
// Lookups (pre-fetched by the executor before calling this function)
// ---------------------------------------------------------------------------

export interface WebhookLookups {
  /**
   * Populated for payment_intent.* events — the booking that owns the intent,
   * plus the market's auto-accept flag (single round-trip join).
   */
  bookingByPaymentIntent?: { id: string; marketId: string; autoAccept: boolean } | null
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface InterpretInput {
  event: Stripe.Event
  lookups: WebhookLookups
  now: Date
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function interpretWebhookEvent(input: InterpretInput): WebhookCommand[] {
  const { event, lookups } = input

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const b = lookups.bookingByPaymentIntent
      if (!b) return [{ type: 'noop', reason: 'no booking for payment_intent' }]
      return [{ type: 'booking.markPaid', bookingId: b.id, autoAccept: b.autoAccept, paymentIntentId: pi.id }]
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      const b = lookups.bookingByPaymentIntent
      if (!b) return [{ type: 'noop', reason: 'no booking for payment_intent' }]
      const reason = (pi.last_payment_error as { message?: string } | null)?.message ?? 'Payment failed'
      return [{ type: 'booking.markPaymentFailed', bookingId: b.id, reason }]
    }

    case 'payment_intent.canceled': {
      const b = lookups.bookingByPaymentIntent
      if (!b) return [{ type: 'noop', reason: 'no booking for payment_intent' }]
      return [{ type: 'booking.markCanceled', bookingId: b.id }]
    }

    case 'account.updated': {
      const acct = event.data.object as Stripe.Account
      const chargesEnabled = !!acct.charges_enabled
      const payoutsEnabled = !!acct.payouts_enabled
      const detailsSubmitted = !!acct.details_submitted
      const complete = chargesEnabled && detailsSubmitted && payoutsEnabled
      return [{
        type: 'account.setOnboarding',
        stripeAccountId: acct.id,
        complete,
        chargesEnabled,
        payoutsEnabled,
      }]
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') {
        return [{ type: 'noop', reason: 'checkout.session.completed mode is not subscription' }]
      }

      const userId = session.metadata?.user_id
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : undefined

      if (userId) {
        return [{
          type: 'subscription.setTier',
          lookup: { userId },
          tier: 1,
          subscriptionId,
        }]
      }

      // Fallback: use customer ID
      const customerId = typeof session.customer === 'string' ? session.customer : null
      if (!customerId) {
        return [{
          type: 'log.warn',
          msg: 'checkout.session.completed: no user_id or customer_id',
          context: { sessionId: session.id },
        }]
      }

      return [{
        type: 'subscription.setTier',
        lookup: { customerId },
        tier: 1,
        subscriptionId,
      }]
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : null
      if (!customerId) return [{ type: 'noop', reason: 'no customer id on subscription' }]
      return [{
        type: 'subscription.setTier',
        lookup: { customerId },
        tier: 0,
        subscriptionId: subscription.id,
      }]
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      return [{
        type: 'log.warn',
        msg: 'invoice.payment_failed',
        context: {
          invoiceId: invoice.id,
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
        },
      }]
    }

    default:
      return [{ type: 'noop', reason: `unhandled event type: ${event.type}` }]
  }
}
