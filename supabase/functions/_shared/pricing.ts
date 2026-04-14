/**
 * Pricing logic for bookings — mirrors packages/shared/src/booking.ts
 *
 * Edge functions (Deno) cannot import from @fyndstigen/shared directly.
 * This file MUST stay in sync with the shared package. Any change to
 * COMMISSION_RATE or calculateCommission must be reflected here.
 *
 * The canonical source is packages/shared/src/booking.ts.
 */

export const COMMISSION_RATE = 0.12

export function calculateCommission(priceSek: number, rate = COMMISSION_RATE): number {
  if (priceSek < 0) throw new Error('Price cannot be negative')
  if (rate < 0 || rate > 1) throw new Error('Rate must be between 0 and 1')
  return Math.round(priceSek * rate)
}

export function calculateStripeAmounts(priceSek: number) {
  const commissionSek = calculateCommission(priceSek)
  const totalOre = (priceSek + commissionSek) * 100
  const applicationFeeOre = commissionSek * 100
  return { priceSek, commissionSek, totalOre, applicationFeeOre, commissionRate: COMMISSION_RATE }
}
