import { describe, it, expect } from 'vitest'
import { StripePaymentCancelInput, StripePaymentCancelOutput } from './stripe-payment-cancel'

describe('StripePaymentCancelInput', () => {
  it('accepts valid denied status', () => {
    const result = StripePaymentCancelInput.safeParse({ bookingId: 'b-1', newStatus: 'denied' })
    expect(result.success).toBe(true)
  })

  it('accepts valid cancelled status', () => {
    const result = StripePaymentCancelInput.safeParse({ bookingId: 'b-1', newStatus: 'cancelled' })
    expect(result.success).toBe(true)
  })

  it('rejects empty bookingId', () => {
    const result = StripePaymentCancelInput.safeParse({ bookingId: '', newStatus: 'denied' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid newStatus', () => {
    const result = StripePaymentCancelInput.safeParse({ bookingId: 'b-1', newStatus: 'confirmed' })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const result = StripePaymentCancelInput.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('StripePaymentCancelOutput', () => {
  it('accepts { success: true }', () => {
    const result = StripePaymentCancelOutput.safeParse({ success: true })
    expect(result.success).toBe(true)
  })

  it('rejects { success: false }', () => {
    const result = StripePaymentCancelOutput.safeParse({ success: false })
    expect(result.success).toBe(false)
  })

  it('round-trips through JSON', () => {
    const sample = { success: true as const }
    const parsed = StripePaymentCancelOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
