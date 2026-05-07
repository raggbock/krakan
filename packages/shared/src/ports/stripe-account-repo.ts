/**
 * StripeAccountRepo — port for managing Stripe Connect account metadata.
 */
export interface StripeAccountRepo {
  /**
   * Update the onboarding_complete flag for a Stripe Connect account.
   */
  setOnboardingComplete(stripeAccountId: string, complete: boolean): Promise<void>
}
