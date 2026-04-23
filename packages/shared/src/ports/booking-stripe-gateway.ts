/**
 * BookingStripeGateway — port for Stripe operations scoped to the booking domain.
 *
 * Owns idempotency-key construction, application-fee math (via
 * `calculateStripeAmounts`), and Connect `transfer_data` routing.
 * Each method maps 1-to-1 to a Stripe API call — no domain state is
 * read or written here.
 *
 * Failure modes:
 * - `createPaymentIntentWithFees`: if this throws the booking row has not
 *   been created yet, so no compensating action is needed.
 * - `capture`: if this throws after the edge has already decided to approve,
 *   the caller is responsible for logging / alerting. The DB UPDATE in the
 *   edge should not proceed if this throws (current edges already do this).
 * - `cancel`: idempotent on Stripe's side; safe to retry.
 */

export type CreatePaymentIntentArgs = {
  /** Price of the table in SEK (integer). */
  priceSek: number
  /** Stripe account ID of the organizer (Connect Standard). */
  stripeAccountId: string
  /** Stripe capture method — 'automatic' for auto-accept, 'manual' for organizer approval. */
  captureMethod: 'automatic' | 'manual'
  /** Idempotency seed — caller supplies the components; gateway composes the key. */
  idempotencyKey: string
  metadata: {
    market_table_id: string
    flea_market_id: string
    booked_by: string
    booking_date: string
  }
}

export interface BookingStripeGateway {
  /**
   * Create a PaymentIntent with platform application-fee and Connect routing.
   * Returns the intent's `id` and `client_secret`.
   */
  createPaymentIntentWithFees(args: CreatePaymentIntentArgs): Promise<{ id: string; clientSecret: string }>

  /**
   * Capture a previously authorized PaymentIntent.
   * Throws on Stripe API error.
   */
  capture(paymentIntentId: string): Promise<void>

  /**
   * Cancel a PaymentIntent.
   * Throws on Stripe API error.
   */
  cancel(paymentIntentId: string, reason?: string): Promise<void>
}
