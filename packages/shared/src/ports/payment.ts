/**
 * PaymentGateway port — abstracts card payment confirmation.
 *
 * Models the Stripe Elements `confirmCardPayment` contract faithfully.
 * Card errors surface synchronously in the returned result (not thrown) so
 * callers can display them to the user without a try/catch.
 */
export interface PaymentGateway {
  /**
   * Confirm a card payment using the client secret returned by the edge function.
   * Returns `{ status: 'succeeded' }` on success, or `{ status: 'failed', error }` on failure.
   * Never throws — errors come back in the result object for UX parity with Stripe Elements.
   */
  confirmCardPayment(clientSecret: string): Promise<PaymentResult>
}

export type PaymentResult =
  | { status: 'succeeded' }
  | { status: 'failed'; error: string }
