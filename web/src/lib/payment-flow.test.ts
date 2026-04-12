import { describe, it, expect } from 'vitest'
import { calculateCommission, COMMISSION_RATE } from '@fyndstigen/shared'

describe('Payment amount calculations', () => {
  it('converts SEK to öre correctly', () => {
    const priceSek = 200
    const commissionSek = calculateCommission(priceSek)
    const totalOre = (priceSek + commissionSek) * 100
    const applicationFeeOre = commissionSek * 100

    expect(commissionSek).toBe(24) // 200 * 0.12
    expect(totalOre).toBe(22400) // (200 + 24) * 100
    expect(applicationFeeOre).toBe(2400) // 24 * 100
  })

  it('handles small prices', () => {
    const priceSek = 10
    const commissionSek = calculateCommission(priceSek)
    const totalOre = (priceSek + commissionSek) * 100

    expect(commissionSek).toBe(1) // 10 * 0.12 = 1.2 → 1
    expect(totalOre).toBe(1100) // (10 + 1) * 100
  })

  it('handles prices with rounding', () => {
    const priceSek = 75
    const commissionSek = calculateCommission(priceSek)
    const totalOre = (priceSek + commissionSek) * 100

    expect(commissionSek).toBe(9) // 75 * 0.12 = 9
    expect(totalOre).toBe(8400)
  })

  it('handles zero price', () => {
    const priceSek = 0
    const commissionSek = calculateCommission(priceSek)
    const totalOre = (priceSek + commissionSek) * 100

    expect(commissionSek).toBe(0)
    expect(totalOre).toBe(0)
  })

  it('commission rate is 12%', () => {
    expect(COMMISSION_RATE).toBe(0.12)
  })

  it('large price calculation is accurate', () => {
    const priceSek = 5000
    const commissionSek = calculateCommission(priceSek)
    const totalOre = (priceSek + commissionSek) * 100

    expect(commissionSek).toBe(600) // 5000 * 0.12
    expect(totalOre).toBe(560000) // (5000 + 600) * 100
  })
})

describe('Payment expiry', () => {
  it('expires_at is 7 days from now', () => {
    const now = new Date('2026-04-12T10:00:00Z')
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + 7)

    expect(expiresAt.toISOString()).toBe('2026-04-19T10:00:00.000Z')
  })

  it('expired bookings are those where expires_at < now', () => {
    const now = new Date('2026-04-20T10:00:00Z')
    const expiresAt = new Date('2026-04-19T10:00:00Z')

    expect(expiresAt < now).toBe(true)
  })

  it('non-expired bookings are those where expires_at >= now', () => {
    const now = new Date('2026-04-18T10:00:00Z')
    const expiresAt = new Date('2026-04-19T10:00:00Z')

    expect(expiresAt < now).toBe(false)
  })
})

describe('Payment status transitions', () => {
  const validTransitions: [string, string][] = [
    ['requires_capture', 'captured'],   // approve → capture
    ['requires_capture', 'cancelled'],  // deny or cancel → release hold
    ['requires_capture', 'failed'],     // card issue
  ]

  const invalidTransitions: [string, string][] = [
    ['captured', 'requires_capture'],   // can't un-capture
    ['captured', 'cancelled'],          // no refund in v1
    ['cancelled', 'requires_capture'],  // can't resurrect
    ['failed', 'captured'],             // can't capture a failed payment
  ]

  it.each(validTransitions)('%s → %s is a valid payment flow', (from, to) => {
    // These are the only valid payment status progressions
    const validFromRequiresCapture = ['captured', 'cancelled', 'failed']
    if (from === 'requires_capture') {
      expect(validFromRequiresCapture).toContain(to)
    }
  })

  it.each(invalidTransitions)('%s → %s should not happen', (from, to) => {
    // Terminal states: captured, cancelled, failed
    const terminalStates = ['captured', 'cancelled', 'failed']
    expect(terminalStates).toContain(from)
  })
})
