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

export function isFreePriced(priceSek: number): boolean {
  return priceSek === 0
}

type BookingOutcome = {
  status: 'pending' | 'confirmed'
  paymentStatus: 'free' | 'requires_payment' | 'requires_capture'
  needsStripe: boolean
  captureMethod: 'automatic' | 'manual' | null
  expiresAt: string | null
}

export function resolveBookingOutcome(priceSek: number, autoAccept: boolean): BookingOutcome {
  const free = isFreePriced(priceSek)

  if (free && autoAccept) {
    return { status: 'confirmed', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: null }
  }

  if (free && !autoAccept) {
    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    return { status: 'pending', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: expires.toISOString() }
  }

  if (!free && autoAccept) {
    return { status: 'pending', paymentStatus: 'requires_payment', needsStripe: true, captureMethod: 'automatic', expiresAt: null }
  }

  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return { status: 'pending', paymentStatus: 'requires_capture', needsStripe: true, captureMethod: 'manual', expiresAt: expires.toISOString() }
}
