/**
 * PaymentGateway port — abstracts card payment confirmation.
 *
 * `confirmCardPayment` resolves when payment fully completes (status ===
 * 'requires_capture' for manual-capture flow, or 'succeeded' otherwise) and
 * rejects with an Error on failure or cancellation.
 *
 * The `PaymentResult` type is kept for adapter implementations that need to
 * inspect the raw outcome before deciding whether to throw.
 */
export interface PaymentGateway {
  /**
   * Confirm a card payment identified by `clientSecret`.
   * Resolves on success; throws on failure or cancellation.
   */
  confirmCardPayment(clientSecret: string): Promise<void>
}

/**
 * @deprecated Used only inside gateway adapter implementations.
 * External callers should rely on the throw/resolve contract of
 * `PaymentGateway.confirmCardPayment`.
 */
export type PaymentResult =
  | { status: 'succeeded' }
  | { status: 'failed'; error: string }
