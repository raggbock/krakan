/**
 * SubscriptionRepo — port for managing organizer subscription tiers.
 *
 * tier 0 = free, tier 1 = paid
 */
export interface SubscriptionRepo {
  /**
   * Set the subscription tier for a user identified by their Supabase user ID.
   */
  setTierByUserId(userId: string, tier: 0 | 1): Promise<void>

  /**
   * Set the subscription tier for a user identified by their Stripe customer ID.
   */
  setTierByCustomerId(customerId: string, tier: 0 | 1): Promise<void>
}
