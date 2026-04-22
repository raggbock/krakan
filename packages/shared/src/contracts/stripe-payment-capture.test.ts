import { describe, it, expect } from 'vitest'
import { StripePaymentCaptureInput, StripePaymentCaptureOutput } from './stripe-payment-capture'

describe('StripePaymentCaptureInput', () => {
  it('accepts a valid booking id', () => {
    const result = StripePaymentCaptureInput.safeParse({ bookingId: 'b-abc123' })
    expect(result.success).toBe(true)
  })

  it('rejects empty bookingId', () => {
    const result = StripePaymentCaptureInput.safeParse({ bookingId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing bookingId', () => {
    const result = StripePaymentCaptureInput.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-string bookingId', () => {
    const result = StripePaymentCaptureInput.safeParse({ bookingId: 42 })
    expect(result.success).toBe(false)
  })
})

describe('StripePaymentCaptureOutput', () => {
  it('accepts { success: true }', () => {
    const result = StripePaymentCaptureOutput.safeParse({ success: true })
    expect(result.success).toBe(true)
  })

  it('rejects { success: false }', () => {
    const result = StripePaymentCaptureOutput.safeParse({ success: false })
    expect(result.success).toBe(false)
  })

  it('rejects missing success field', () => {
    const result = StripePaymentCaptureOutput.safeParse({})
    expect(result.success).toBe(false)
  })

  it('round-trips through JSON', () => {
    const sample = { success: true as const }
    const parsed = StripePaymentCaptureOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
