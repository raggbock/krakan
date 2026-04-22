import { z } from 'zod'

/**
 * Input contract for the stripe-payment-capture edge function.
 *
 * Captures a previously-authorised PaymentIntent and confirms the booking.
 * Only the organizer of the booking's market may call this.
 */
export const StripePaymentCaptureInput = z.object({
  bookingId: z.string().min(1),
})

/**
 * Output contract for the stripe-payment-capture edge function.
 *
 * Returns a simple success flag; the client optimistically updates booking
 * status locally after a successful call.
 */
export const StripePaymentCaptureOutput = z.object({
  success: z.literal(true),
})

export type StripePaymentCaptureInput = z.infer<typeof StripePaymentCaptureInput>
export type StripePaymentCaptureOutput = z.infer<typeof StripePaymentCaptureOutput>
