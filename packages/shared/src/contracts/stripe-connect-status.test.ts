import { describe, it, expect } from 'vitest'
import { StripeConnectStatusInput, StripeConnectStatusOutput } from './stripe-connect-status'

describe('StripeConnectStatusInput', () => {
  it('accepts an empty object (no body required)', () => {
    const result = StripeConnectStatusInput.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects unexpected fields (strict schema)', () => {
    const result = StripeConnectStatusInput.safeParse({ extra: 'field' })
    expect(result.success).toBe(false)
  })
})

describe('StripeConnectStatusOutput', () => {
  it('accepts connected and complete', () => {
    const result = StripeConnectStatusOutput.safeParse({ connected: true, onboarding_complete: true })
    expect(result.success).toBe(true)
  })

  it('accepts not connected', () => {
    const result = StripeConnectStatusOutput.safeParse({ connected: false, onboarding_complete: false })
    expect(result.success).toBe(true)
  })

  it('rejects missing connected field', () => {
    const result = StripeConnectStatusOutput.safeParse({ onboarding_complete: true })
    expect(result.success).toBe(false)
  })

  it('round-trips through JSON', () => {
    const sample = { connected: true, onboarding_complete: false }
    const parsed = StripeConnectStatusOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
