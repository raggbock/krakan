/**
 * prefetchLookups — performs any DB reads needed before the pure reducer runs.
 *
 * Only payment_intent.* events need a lookup today. All other event families
 * return an empty object. This is the only place in the webhook that switches
 * on Stripe event type outside the reducer; it is intentionally kept dumb
 * (one query per event family).
 */

import type Stripe from 'https://esm.sh/stripe@17?target=deno'
import type { WebhookLookups } from '@fyndstigen/shared/stripe-webhook.ts'
import type { BookingRepo } from '@fyndstigen/shared/ports/booking-repo.ts'

export interface LookupRepos {
  bookings: BookingRepo
}

export async function prefetchLookups(
  event: Stripe.Event,
  repos: LookupRepos,
): Promise<WebhookLookups> {
  if (
    event.type === 'payment_intent.succeeded' ||
    event.type === 'payment_intent.payment_failed' ||
    event.type === 'payment_intent.canceled'
  ) {
    const pi = event.data.object as Stripe.PaymentIntent
    const result = await repos.bookings.findByPaymentIntent(pi.id)
    if (!result) return { bookingByPaymentIntent: null }
    return {
      bookingByPaymentIntent: {
        id: result.booking.id,
        marketId: result.booking.flea_market_id,
        autoAccept: result.autoAccept,
      },
    }
  }

  return {}
}
