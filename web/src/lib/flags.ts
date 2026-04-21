/**
 * Feature flags — PostHog-backed with environment-variable fallback.
 *
 * Resolution order (client):
 *   1. PostHog feature-flag evaluation (if the SDK is initialised)
 *   2. Environment variable (NEXT_PUBLIC_FLAG_<KEY>, plus back-compat aliases)
 *   3. Caller-supplied defaultValue
 *   4. false
 *
 * On the server the PostHog step is skipped. Use `getFlagEnv` in server
 * components / route handlers.
 */

import { usePostHog } from 'posthog-js/react'

export type FlagKey = 'payments' | 'skyltfonstret'

/**
 * Read the env-var fallback for a flag. Pure; safe on server & client.
 *
 * For `payments` we keep the historical behaviour of treating the presence
 * of NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as an implicit enable, so existing
 * staging/prod deploys don't silently flip off.
 *
 * For `skyltfonstret` we also accept the legacy NEXT_PUBLIC_SKYLTFONSTRET
 * name for back-compat.
 */
export function getFlagEnv(key: FlagKey, defaultValue = false): boolean {
  switch (key) {
    case 'payments': {
      const explicit = process.env.NEXT_PUBLIC_FLAG_PAYMENTS
      if (explicit === 'true') return true
      if (explicit === 'false') return false
      // Back-compat: any truthy publishable key turns payments on.
      if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) return true
      return defaultValue
    }
    case 'skyltfonstret': {
      const explicit = process.env.NEXT_PUBLIC_FLAG_SKYLTFONSTRET
      if (explicit === 'true') return true
      if (explicit === 'false') return false
      // Back-compat with the original env var name.
      const legacy = process.env.NEXT_PUBLIC_SKYLTFONSTRET
      if (legacy === 'true') return true
      if (legacy === 'false') return false
      return defaultValue
    }
    default: {
      // Exhaustiveness guard
      const _exhaustive: never = key
      return _exhaustive
    }
  }

  // TODO: server-side PostHog evaluation via posthog-node once we need
  // dynamic targeting in server components / route handlers.
}

/**
 * Client hook — reads PostHog first, then falls back to env, then default.
 *
 * Safe in SSR: when `window` is undefined we skip the PostHog step.
 */
export function useFlag(key: FlagKey, defaultValue = false): boolean {
  const posthog = usePostHog()

  if (typeof window !== 'undefined' && posthog) {
    const evaluated = posthog.isFeatureEnabled(key)
    if (typeof evaluated === 'boolean') return evaluated
  }

  return getFlagEnv(key, defaultValue)
}
