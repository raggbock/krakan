import { z } from 'zod'

/**
 * Input contract for the stripe-connect-status edge function.
 *
 * Checks whether the authenticated organizer has a connected Stripe account
 * and whether onboarding is complete.
 * No request body is required — the organizer identity comes from the JWT.
 */
export const StripeConnectStatusInput = z.object({}).strict()

/**
 * Output contract for the stripe-connect-status edge function.
 */
export const StripeConnectStatusOutput = z.object({
  connected: z.boolean(),
  onboarding_complete: z.boolean(),
})

export type StripeConnectStatusInput = z.infer<typeof StripeConnectStatusInput>
export type StripeConnectStatusOutput = z.infer<typeof StripeConnectStatusOutput>
