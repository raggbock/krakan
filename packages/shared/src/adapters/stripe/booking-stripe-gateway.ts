/**
 * Stripe adapter for BookingStripeGateway.
 *
 * Accepts an already-constructed Stripe client so that:
 *  - Edge functions (Deno) pass their own `stripe` instance from
 *    `supabase/functions/_shared/stripe.ts`.
 *  - Tests pass a fake/mock Stripe instance.
 *
 * This keeps the adapter free of Deno-specific imports and avoids
 * pulling the Stripe SDK into the shared package's Node dependencies.
 */

import { calculateStripeAmounts } from '../../booking'
import type { BookingStripeGateway, CreatePaymentIntentArgs } from '../../ports/booking-stripe-gateway'

/** Minimal Stripe client interface this adapter needs. */
export interface StripeClient {
  paymentIntents: {
    create(
      params: Record<string, unknown>,
      options?: { idempotencyKey?: string },
    ): Promise<{ id: string; client_secret: string | null }>
    capture(id: string): Promise<void>
    cancel(id: string, params?: Record<string, unknown>): Promise<void>
  }
}

export function createStripeBookingGateway(stripe: StripeClient): BookingStripeGateway {
  return {
    async createPaymentIntentWithFees(args: CreatePaymentIntentArgs) {
      const { totalOre, applicationFeeOre } = calculateStripeAmounts(args.priceSek)
      const pi = await stripe.paymentIntents.create(
        {
          amount: totalOre,
          currency: 'sek',
          capture_method: args.captureMethod,
          application_fee_amount: applicationFeeOre,
          transfer_data: { destination: args.stripeAccountId },
          metadata: args.metadata,
        },
        { idempotencyKey: args.idempotencyKey },
      )
      if (!pi.client_secret) throw new Error('PaymentIntent missing client_secret')
      return { id: pi.id, clientSecret: pi.client_secret }
    },

    async capture(paymentIntentId) {
      await stripe.paymentIntents.capture(paymentIntentId)
    },

    async cancel(paymentIntentId, reason) {
      await stripe.paymentIntents.cancel(
        paymentIntentId,
        reason ? { cancellation_reason: reason } : undefined,
      )
    },
  }
}
