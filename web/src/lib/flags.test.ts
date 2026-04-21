import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockIsFeatureEnabled = vi.fn<(key: string) => boolean | undefined>()

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ isFeatureEnabled: mockIsFeatureEnabled }),
}))

// Import after the mock is registered.
import { getFlagEnv, useFlag } from './flags'

const FLAG_ENV_KEYS = [
  'NEXT_PUBLIC_FLAG_PAYMENTS',
  'NEXT_PUBLIC_FLAG_SKYLTFONSTRET',
  'NEXT_PUBLIC_SKYLTFONSTRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const

let savedEnv: Partial<Record<(typeof FLAG_ENV_KEYS)[number], string | undefined>>

beforeEach(() => {
  mockIsFeatureEnabled.mockReset()
  // Save + clear the flag-related env so each test starts from a known state.
  savedEnv = {}
  for (const k of FLAG_ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of FLAG_ENV_KEYS) {
    const v = savedEnv[k]
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
})

describe('useFlag', () => {
  it('returns true when PostHog evaluates the flag to true', () => {
    mockIsFeatureEnabled.mockReturnValue(true)
    const { result } = renderHook(() => useFlag('payments'))
    expect(result.current).toBe(true)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('payments')
  })

  it('returns false when PostHog evaluates the flag to false', () => {
    mockIsFeatureEnabled.mockReturnValue(false)
    // Even with the env that would normally enable payments, PostHog wins.
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test'
    const { result } = renderHook(() => useFlag('payments'))
    expect(result.current).toBe(false)
  })

  it('falls back to env when PostHog returns undefined', () => {
    mockIsFeatureEnabled.mockReturnValue(undefined)
    process.env.NEXT_PUBLIC_FLAG_SKYLTFONSTRET = 'true'
    const { result } = renderHook(() => useFlag('skyltfonstret'))
    expect(result.current).toBe(true)
  })

  it('returns true when the explicit env flag is "true"', () => {
    mockIsFeatureEnabled.mockReturnValue(undefined)
    process.env.NEXT_PUBLIC_FLAG_PAYMENTS = 'true'
    const { result } = renderHook(() => useFlag('payments'))
    expect(result.current).toBe(true)
  })

  it('returns the supplied default when env is unset and PostHog is silent', () => {
    mockIsFeatureEnabled.mockReturnValue(undefined)
    const { result } = renderHook(() => useFlag('skyltfonstret', true))
    expect(result.current).toBe(true)

    const { result: result2 } = renderHook(() => useFlag('skyltfonstret'))
    expect(result2.current).toBe(false)
  })
})

describe('getFlagEnv', () => {
  it('returns true when the explicit env flag is "true"', () => {
    process.env.NEXT_PUBLIC_FLAG_PAYMENTS = 'true'
    expect(getFlagEnv('payments')).toBe(true)
  })

  it('returns the default when env is unset', () => {
    expect(getFlagEnv('skyltfonstret')).toBe(false)
    expect(getFlagEnv('skyltfonstret', true)).toBe(true)
  })

  it('honours the legacy NEXT_PUBLIC_SKYLTFONSTRET env var', () => {
    process.env.NEXT_PUBLIC_SKYLTFONSTRET = 'true'
    expect(getFlagEnv('skyltfonstret')).toBe(true)
  })

  it('treats a present Stripe publishable key as payments=true (back-compat)', () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc'
    expect(getFlagEnv('payments')).toBe(true)
  })

  it('lets NEXT_PUBLIC_FLAG_PAYMENTS=false override the legacy Stripe-key heuristic', () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc'
    process.env.NEXT_PUBLIC_FLAG_PAYMENTS = 'false'
    expect(getFlagEnv('payments')).toBe(false)
  })
})
