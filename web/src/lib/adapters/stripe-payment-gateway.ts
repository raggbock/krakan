import type { Stripe, StripeCardElement } from '@stripe/stripe-js'
import type { PaymentGateway, PaymentResult } from '@fyndstigen/shared'

/**
 * Stripe Elements adapter for the PaymentGateway port.
 *
 * Accepts the Stripe instance and the card element lazily so the gateway can
 * be constructed without triggering module-load side-effects. The caller
 * (useBooking) retrieves both from React context at submit time.
 */
export function createStripePaymentGateway(
  stripe: Stripe,
  cardElement: StripeCardElement,
): PaymentGateway {
  return {
    async confirmCardPayment(clientSecret: string): Promise<PaymentResult> {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      })
      if (error) {
        return { status: 'failed', error: error.message ?? 'Kortbetalning misslyckades' }
      }
      return { status: 'succeeded' }
    },
  }
}

/**
 * No-op gateway used when Stripe isn't available (free bookings, or paid
 * bookings where Stripe.js hasn't loaded yet). Succeeds silently if never
 * called with a clientSecret; throws `reason` if invoked — free bookings
 * don't return a clientSecret, so this path is only reached as a regression.
 */
export function createNoOpPaymentGateway(reason: string): PaymentGateway {
  return {
    async confirmCardPayment(clientSecret: string): Promise<PaymentResult> {
      if (clientSecret) throw new Error(reason)
      return { status: 'succeeded' }
    },
  }
}
