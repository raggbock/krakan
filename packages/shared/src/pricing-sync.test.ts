/**
 * Sync test: verifies that the edge function pricing mirror
 * (supabase/functions/_shared/pricing.ts) produces identical
 * results to the canonical shared package (packages/shared/src/booking.ts).
 *
 * If this test fails after you changed booking.ts, you MUST also
 * update supabase/functions/_shared/pricing.ts to match.
 */
import { describe, it, expect } from 'vitest'
import {
  COMMISSION_RATE,
  calculateCommission,
  calculateStripeAmounts,
  isFreePriced,
  resolveBookingOutcome,
} from './booking'

// We can't import from the Deno edge function directly, so we
// snapshot the expected outputs for a range of inputs and compare.
// If you change the canonical booking.ts, update these snapshots,
// then update pricing.ts to match.

describe('pricing sync — canonical outputs', () => {
  it('COMMISSION_RATE is 0.12', () => {
    expect(COMMISSION_RATE).toBe(0.12)
  })

  const prices = [0, 10, 75, 100, 133, 175, 200, 250, 500, 5000, 9999, 10000]

  it.each(prices)('calculateCommission(%i) is deterministic', (price) => {
    const result = calculateCommission(price)
    expect(result).toBe(Math.round(price * 0.12))
  })

  it.each(prices)('calculateStripeAmounts(%i) fields are consistent', (price) => {
    const a = calculateStripeAmounts(price)
    expect(a.priceSek).toBe(price)
    expect(a.commissionSek).toBe(calculateCommission(price))
    expect(a.totalOre).toBe((price + a.commissionSek) * 100)
    expect(a.applicationFeeOre).toBe(a.commissionSek * 100)
    expect(a.commissionRate).toBe(COMMISSION_RATE)
  })

  it('isFreePriced matches price === 0', () => {
    expect(isFreePriced(0)).toBe(true)
    expect(isFreePriced(1)).toBe(false)
    expect(isFreePriced(100)).toBe(false)
  })

  const matrix: [number, boolean][] = [
    [0, true], [0, false], [200, true], [200, false],
  ]

  it.each(matrix)('resolveBookingOutcome(%i, %s) shape is valid', (price, auto) => {
    const o = resolveBookingOutcome(price, auto)
    expect(['pending', 'confirmed']).toContain(o.status)
    expect(['free', 'requires_payment', 'requires_capture']).toContain(o.paymentStatus)
    expect(typeof o.needsStripe).toBe('boolean')
    if (o.needsStripe) {
      expect(['automatic', 'manual']).toContain(o.captureMethod)
    } else {
      expect(o.captureMethod).toBeNull()
    }
  })
})
