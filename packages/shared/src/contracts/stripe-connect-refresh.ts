import { z } from 'zod'

/**
 * Input contract for the stripe-connect-refresh edge function.
 *
 * Generates a new Stripe onboarding link for an organizer whose previous link
 * has expired. The organizer must have an existing Stripe account.
 * No request body is required — the organizer identity comes from the JWT.
 */
export const StripeConnectRefreshInput = z.object({}).strict()

/**
 * Output contract for the stripe-connect-refresh edge function.
 *
 * Returns a fresh Stripe hosted onboarding URL.
 */
export const StripeConnectRefreshOutput = z.object({
  url: z.string().min(1),
})

export type StripeConnectRefreshInput = z.infer<typeof StripeConnectRefreshInput>
export type StripeConnectRefreshOutput = z.infer<typeof StripeConnectRefreshOutput>
