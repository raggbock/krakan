import type { BookingStatus, OpeningHourRule, OpeningHourException } from './types'
import { checkOpeningHours } from './opening-hours'
import type { ErrorCode } from './errors'
import { messageFor } from './errors'

export type OpeningHoursContext = {
  rules: OpeningHourRule[]
  exceptions: OpeningHourException[]
}

export const COMMISSION_RATE = 0.12

export function calculateCommission(priceSek: number, rate = COMMISSION_RATE): number {
  if (priceSek < 0) throw new Error('Price cannot be negative')
  if (rate < 0 || rate > 1) throw new Error('Rate must be between 0 and 1')
  return Math.round(priceSek * rate)
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'denied', 'cancelled'],
  confirmed: ['cancelled'],
  denied: [],
  cancelled: [],
}

export function isValidStatusTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * Result of validateBookingDate.
 *
 * On failure, `code` is the canonical ErrorCode and `error` is the
 * pre-rendered Swedish string for backwards compatibility.
 *
 * @deprecated `error` — Delete after all callers migrate to `code`.
 * TODO: File a follow-up issue to remove the `error` field once use-booking
 * and booking-service.test are updated to call messageFor(code) directly.
 */
export type BookingDateValidation =
  | { valid: true }
  | { valid: false; code: ErrorCode; params?: Record<string, string | number>
      /** @deprecated Use messageFor(code) instead. Delete after all callers migrate. */
      error: string }

export function validateBookingDate(
  dateStr: string,
  bookedDates: string[],
  today: string,
  openingHours?: OpeningHoursContext,
): BookingDateValidation {
  function fail(code: ErrorCode, params?: Record<string, string | number>): BookingDateValidation {
    return { valid: false, code, params, error: messageFor(code, params) }
  }

  if (!dateStr) return fail('booking.date.required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fail('booking.date.invalid_format')

  const date = new Date(dateStr + 'T12:00:00')
  if (isNaN(date.getTime())) return fail('booking.date.invalid')
  if (dateStr < today) return fail('booking.date.in_past')
  if (bookedDates.includes(dateStr)) return fail('booking.date.already_booked')

  if (openingHours) {
    const result = checkOpeningHours(openingHours.rules, openingHours.exceptions, dateStr)
    if (!result.isOpen) return fail('booking.market_closed')
  }

  return { valid: true }
}

export function calculateStripeAmounts(priceSek: number) {
  const commissionSek = calculateCommission(priceSek)
  const totalOre = (priceSek + commissionSek) * 100
  const applicationFeeOre = commissionSek * 100
  return { priceSek, commissionSek, totalOre, applicationFeeOre, commissionRate: COMMISSION_RATE }
}

export function generateBatchLabels(prefix: string, count: number, startAt = 1): string[] {
  if (count < 1 || count > 100) throw new Error('Count must be 1-100')
  if (!prefix.trim()) throw new Error('Prefix is required')
  return Array.from({ length: count }, (_, i) => `${prefix.trim()} ${startAt + i}`)
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
    const expires = new Date()
    expires.setDate(expires.getDate() + 1)
    return { status: 'pending', paymentStatus: 'requires_payment', needsStripe: true, captureMethod: 'automatic', expiresAt: expires.toISOString() }
  }

  // paid + manual
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return { status: 'pending', paymentStatus: 'requires_capture', needsStripe: true, captureMethod: 'manual', expiresAt: expires.toISOString() }
}
