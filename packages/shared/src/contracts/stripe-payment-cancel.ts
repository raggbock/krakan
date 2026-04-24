import { z } from 'zod'

/**
 * Input contract for the stripe-payment-cancel edge function.
 *
 * Cancels or denies a pending booking and voids the Stripe PaymentIntent if
 * one exists. Organizers may deny; bookers may cancel their own bookings.
 */
export const StripePaymentCancelInput = z.object({
  bookingId: z.string().min(1),
  newStatus: z.enum(['denied', 'cancelled']),
})

/**
 * Output contract for the stripe-payment-cancel edge function.
 *
 * Returns a simple success flag on a successful cancellation/denial.
 */
export const StripePaymentCancelOutput = z.object({
  success: z.literal(true),
})

export type StripePaymentCancelInput = z.infer<typeof StripePaymentCancelInput>
export type StripePaymentCancelOutput = z.infer<typeof StripePaymentCancelOutput>
