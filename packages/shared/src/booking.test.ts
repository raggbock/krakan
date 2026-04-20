import { describe, it, expect } from 'vitest'
import {
  isFreePriced,
  resolveBookingOutcome,
} from './booking'

describe('isFreePriced', () => {
  it('returns true for price 0', () => {
    expect(isFreePriced(0)).toBe(true)
  })

  it('returns false for price > 0', () => {
    expect(isFreePriced(100)).toBe(false)
  })
})

describe('resolveBookingOutcome', () => {
  it('free + auto-accept → confirmed/free, no stripe', () => {
    const result = resolveBookingOutcome(0, true)
    expect(result).toEqual({
      status: 'confirmed',
      paymentStatus: 'free',
      needsStripe: false,
      captureMethod: null,
      expiresAt: null,
    })
  })

  it('free + manual → pending/free, no stripe, has expiry', () => {
    const result = resolveBookingOutcome(0, false)
    expect(result.status).toBe('pending')
    expect(result.paymentStatus).toBe('free')
    expect(result.needsStripe).toBe(false)
    expect(result.captureMethod).toBeNull()
    expect(result.expiresAt).not.toBeNull()
  })

  it('paid + auto-accept → pending/requires_payment, stripe automatic, has 24h expiry', () => {
    const result = resolveBookingOutcome(200, true)
    expect(result.status).toBe('pending')
    expect(result.paymentStatus).toBe('requires_payment')
    expect(result.needsStripe).toBe(true)
    expect(result.captureMethod).toBe('automatic')
    expect(result.expiresAt).not.toBeNull()
  })

  it('paid + manual → pending/requires_capture, stripe manual, has expiry', () => {
    const result = resolveBookingOutcome(200, false)
    expect(result.status).toBe('pending')
    expect(result.paymentStatus).toBe('requires_capture')
    expect(result.needsStripe).toBe(true)
    expect(result.captureMethod).toBe('manual')
    expect(result.expiresAt).not.toBeNull()
  })
})
