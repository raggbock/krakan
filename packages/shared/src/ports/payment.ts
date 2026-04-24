/**
 * PaymentGateway port — abstracts card payment confirmation.
 *
 * Today this only collapses `confirmCardPayment` into `{ status, error? }`
 * with a single error string. It does NOT yet discriminate card_error vs
 * requires_action vs authentication_required — add an `errorCode` field
 * (and matching adapter mapping) before wiring 3DS / SCA flows.
 */
export interface PaymentGateway {
  confirmCardPayment(clientSecret: string): Promise<PaymentResult>
}

export type PaymentResult =
  | { status: 'succeeded' }
  | { status: 'failed'; error: string }
