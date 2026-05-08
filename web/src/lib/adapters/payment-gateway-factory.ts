import type { Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js'
import type { PaymentGateway } from '@fyndstigen/shared'
import {
  createStripePaymentGateway,
  createNoOpPaymentGateway,
} from './stripe-payment-gateway'

export type ResolvePaymentGatewayOptions = {
  stripe: Stripe | null
  elements: StripeElements | null
}

/**
 * Decide between the real Stripe gateway and the no-op fallback.
 *
 * Rules:
 *  - Stripe instance + mounted CardElement present → real gateway
 *  - Otherwise → no-op gateway (throws if actually invoked with a clientSecret,
 *    which only happens when the edge function returned one — i.e. a regression)
 *
 * `confirmCardPayment` resolves on success and throws on failure.
 * Telemetry (booking_payment_completed etc.) is the hook's responsibility —
 * it consumes the BookingProgress event stream and captures via posthog directly.
 */
export function resolvePaymentGateway({
  stripe,
  elements,
}: ResolvePaymentGatewayOptions): PaymentGateway {
  const cardElement =
    stripe && elements
      ? (elements.getElement('card') as StripeCardElement | null)
      : null

  return stripe && cardElement
    ? createStripePaymentGateway(stripe, cardElement)
    : createNoOpPaymentGateway(!stripe || !elements ? 'Stripe not loaded' : 'Card element not found')
}
