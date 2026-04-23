import { describe, it, expect } from 'vitest'
import { StripeConnectCreateInput, StripeConnectCreateOutput } from './stripe-connect-create'

describe('StripeConnectCreateInput', () => {
  it('accepts an empty object (no body required)', () => {
    const result = StripeConnectCreateInput.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects unexpected fields (strict schema)', () => {
    const result = StripeConnectCreateInput.safeParse({ extra: 'field' })
    expect(result.success).toBe(false)
  })
})

describe('StripeConnectCreateOutput', () => {
  it('accepts a valid URL', () => {
    const result = StripeConnectCreateOutput.safeParse({ url: 'https://connect.stripe.com/onboarding/abc' })
    expect(result.success).toBe(true)
  })

  it('rejects empty url', () => {
    const result = StripeConnectCreateOutput.safeParse({ url: '' })
    expect(result.success).toBe(false)
  })

  it('round-trips through JSON', () => {
    const sample = { url: 'https://connect.stripe.com/onboarding/abc' }
    const parsed = StripeConnectCreateOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
