/**
 * Environment-based feature flags.
 *
 * Toggle features by adding/removing env vars in wrangler.jsonc (prod)
 * or .env.local (dev). No code deploy needed to flip a flag — just
 * update the env var and redeploy.
 *
 * Usage:
 *   import { features } from '@/lib/feature-flags'
 *   if (features.payments) { ... }
 */

export const features = {
  /** Paid bookings + Stripe Connect. Requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. */
  payments: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

  /** Skyltfönstret premium tier (subscription, advanced SEO, gated stats). */
  skyltfonstret: process.env.NEXT_PUBLIC_SKYLTFONSTRET === 'true',
} as const
