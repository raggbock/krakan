import type { Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js'
import type { PaymentGateway } from '@fyndstigen/shared'
import {
  createStripePaymentGateway,
  createNoOpPaymentGateway,
} from './stripe-payment-gateway'

export type ResolvePaymentGatewayOptions = {
  stripe: Stripe | null
  elements: StripeElements | null
  /**
   * Called when a card payment completes successfully (status === 'succeeded').
   * The hook uses this to set a flag before capturing the booking_payment_completed
   * telemetry event — after bookingService.book() resolves and the booking_id is known.
   */
  onPaymentCompleted: () => void
}

/**
 * Decide between the real Stripe gateway and the no-op fallback, then wrap
 * the chosen gateway to fire `onPaymentCompleted` on success.
 *
 * Rules:
 *  - Stripe instance + mounted CardElement present → real gateway
 *  - Otherwise → no-op gateway (throws if actually invoked with a clientSecret,
 *    which only happens when the edge function returned one — i.e. a regression)
 *
 * The wrapper does NOT capture the PostHog event itself: it only sets the flag
 * so the hook can emit the event after book() resolves (when booking_id is known).
 */
export function resolvePaymentGateway({
  stripe,
  elements,
  onPaymentCompleted,
}: ResolvePaymentGatewayOptions): PaymentGateway {
  const cardElement =
    stripe && elements
      ? (elements.getElement('card') as StripeCardElement | null)
      : null

  const base =
    stripe && cardElement
      ? createStripePaymentGateway(stripe, cardElement)
      : createNoOpPaymentGateway(!stripe || !elements ? 'Stripe not loaded' : 'Card element not found')

  return {
    async confirmCardPayment(clientSecret: string) {
      const result = await base.confirmCardPayment(clientSecret)
      if (result.status === 'succeeded') {
        onPaymentCompleted()
      }
      return result
    },
  }
}
