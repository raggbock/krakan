import { z } from 'zod'

/**
 * Input contract for the stripe-connect-create edge function.
 *
 * Creates a Stripe Connect account for the authenticated organizer (or reuses
 * an existing one) and returns an onboarding link URL.
 * No request body is required — the organizer identity comes from the JWT.
 */
export const StripeConnectCreateInput = z.object({}).strict()

/**
 * Output contract for the stripe-connect-create edge function.
 *
 * Returns the Stripe hosted onboarding URL to redirect the organizer to.
 */
export const StripeConnectCreateOutput = z.object({
  url: z.string().min(1),
})

export type StripeConnectCreateInput = z.infer<typeof StripeConnectCreateInput>
export type StripeConnectCreateOutput = z.infer<typeof StripeConnectCreateOutput>
