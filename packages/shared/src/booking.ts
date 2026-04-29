import type { BookingStatus, OpeningHourRule, OpeningHourException } from './types'
import { checkOpeningHours } from './opening-hours'
import type { ErrorCode } from './errors'

export type OpeningHoursContext = {
  rules: OpeningHourRule[]
  exceptions: OpeningHourException[]
}

export const COMMISSION_RATE = 0.12

export function calculateCommission(priceSek: number, rate = COMMISSION_RATE): number {
  // eslint-disable-next-line no-restricted-syntax -- programming invariant: negative price is a caller bug, not a user-facing error
  if (priceSek < 0) throw new Error('Price cannot be negative')
  // eslint-disable-next-line no-restricted-syntax -- programming invariant: invalid rate is a caller bug, not a user-facing error
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
 * On failure, `code` is the canonical ErrorCode.
 * Call `messageFor(code, params)` to get a Swedish user-facing string.
 */
export type BookingDateValidation =
  | { valid: true }
  | { valid: false; code: ErrorCode; params?: Record<string, string | number> }

export function validateBookingDate(
  dateStr: string,
  bookedDates: string[],
  today: string,
  openingHours?: OpeningHoursContext,
): BookingDateValidation {
  function fail(code: ErrorCode, params?: Record<string, string | number>): BookingDateValidation {
    return { valid: false, code, params }
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
  // eslint-disable-next-line no-restricted-syntax -- programming invariant: out-of-range count is a caller bug, not a user-facing error
  if (count < 1 || count > 100) throw new Error('Count must be 1-100')
  // eslint-disable-next-line no-restricted-syntax -- programming invariant: empty prefix is a caller bug, not a user-facing error
  if (!prefix.trim()) throw new Error('Prefix is required')
  return Array.from({ length: count }, (_, i) => `${prefix.trim()} ${startAt + i}`)
}

export function isFreePriced(priceSek: number): boolean {
  return priceSek === 0
}

// ---------------------------------------------------------------------------
// decideCreateBooking — single source of truth for booking-creation decisions
// ---------------------------------------------------------------------------

export type CreateBookingInput = {
  priceSek: number
  autoAccept: boolean
  /** Injectable clock for deterministic testing. Defaults to new Date(). */
  now?: Date
}

/**
 * The DB columns derived purely from (price, autoAccept) at creation time.
 * Returned alongside Stripe-gateway hints so edge functions and tests have a
 * single import for all booking-creation decisions.
 */
export type CreateBookingDecision = {
  /** null when no payment is needed */
  captureMethod: 'manual' | 'automatic' | null
  needsStripe: boolean
  status: 'pending' | 'confirmed'
  paymentStatus: 'free' | 'requires_payment' | 'requires_capture'
  expiresAt: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(days: number, now: Date): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString()
}

/**
 * Pure function. Given price and auto-accept flag, returns every DB column
 * that must be set when a booking row is first inserted.
 *
 * Both the `booking-create` edge function and `applyBookingEvent({type:'created'})`
 * delegate here so the truth-table lives in exactly one place.
 */
export function decideCreateBooking({ priceSek, autoAccept, now = new Date() }: CreateBookingInput): CreateBookingDecision {
  const free = isFreePriced(priceSek)

  if (free && autoAccept) {
    return { status: 'confirmed', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: null }
  }

  if (free && !autoAccept) {
    return { status: 'pending', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: addDays(7, now) }
  }

  if (!free && autoAccept) {
    return { status: 'pending', paymentStatus: 'requires_payment', needsStripe: true, captureMethod: 'automatic', expiresAt: addDays(1, now) }
  }

  // paid + manual
  return { status: 'pending', paymentStatus: 'requires_capture', needsStripe: true, captureMethod: 'manual', expiresAt: addDays(7, now) }
}

/**
 * File-local helper for the booking lifecycle reducer.
 * Wraps the `paid → synthetic priceSek` sentinel so it never leaks into
 * the reducer call site. Not part of the public package API.
 */
export function decidePaidBooking(
  paid: boolean,
  autoAccept: boolean,
  now: Date,
): Pick<CreateBookingDecision, 'status' | 'paymentStatus' | 'expiresAt'> {
  const d = decideCreateBooking({ priceSek: paid ? 1 : 0, autoAccept, now })
  return { status: d.status, paymentStatus: d.paymentStatus, expiresAt: d.expiresAt }
}
