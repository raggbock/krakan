import { describe, it, expect } from 'vitest'
import { StripeConnectRefreshInput, StripeConnectRefreshOutput } from './stripe-connect-refresh'

describe('StripeConnectRefreshInput', () => {
  it('accepts an empty object (no body required)', () => {
    const result = StripeConnectRefreshInput.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects unexpected fields (strict schema)', () => {
    const result = StripeConnectRefreshInput.safeParse({ extra: 'field' })
    expect(result.success).toBe(false)
  })
})

describe('StripeConnectRefreshOutput', () => {
  it('accepts a valid URL', () => {
    const result = StripeConnectRefreshOutput.safeParse({ url: 'https://connect.stripe.com/onboarding/def' })
    expect(result.success).toBe(true)
  })

  it('rejects empty url', () => {
    const result = StripeConnectRefreshOutput.safeParse({ url: '' })
    expect(result.success).toBe(false)
  })

  it('round-trips through JSON', () => {
    const sample = { url: 'https://connect.stripe.com/onboarding/def' }
    const parsed = StripeConnectRefreshOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
