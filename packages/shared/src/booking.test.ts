import { describe, it, expect } from 'vitest'
import {
  isFreePriced,
  decideCreateBooking,
  validateBookingDate,
} from './booking'

describe('isFreePriced', () => {
  it('returns true for price 0', () => {
    expect(isFreePriced(0)).toBe(true)
  })

  it('returns false for price > 0', () => {
    expect(isFreePriced(100)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// decideCreateBooking — single source of truth for creation decisions
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-04-21T12:00:00.000Z')

describe('decideCreateBooking', () => {
  it('free + auto-accept → confirmed/free, no stripe, no expiry', () => {
    const d = decideCreateBooking({ priceSek: 0, autoAccept: true, now: FIXED_NOW })
    expect(d).toEqual({
      status: 'confirmed',
      paymentStatus: 'free',
      needsStripe: false,
      captureMethod: null,
      expiresAt: null,
    })
  })

  it('free + manual → pending/free, no stripe, +7d expiry', () => {
    const d = decideCreateBooking({ priceSek: 0, autoAccept: false, now: FIXED_NOW })
    expect(d.status).toBe('pending')
    expect(d.paymentStatus).toBe('free')
    expect(d.needsStripe).toBe(false)
    expect(d.captureMethod).toBeNull()
    expect(d.expiresAt).toBe('2026-04-28T12:00:00.000Z')
  })

  it('paid + auto-accept → pending/requires_payment, stripe automatic, +1d expiry', () => {
    const d = decideCreateBooking({ priceSek: 200, autoAccept: true, now: FIXED_NOW })
    expect(d.status).toBe('pending')
    expect(d.paymentStatus).toBe('requires_payment')
    expect(d.needsStripe).toBe(true)
    expect(d.captureMethod).toBe('automatic')
    expect(d.expiresAt).toBe('2026-04-22T12:00:00.000Z')
  })

  it('paid + manual → pending/requires_capture, stripe manual, +7d expiry', () => {
    const d = decideCreateBooking({ priceSek: 200, autoAccept: false, now: FIXED_NOW })
    expect(d.status).toBe('pending')
    expect(d.paymentStatus).toBe('requires_capture')
    expect(d.needsStripe).toBe(true)
    expect(d.captureMethod).toBe('manual')
    expect(d.expiresAt).toBe('2026-04-28T12:00:00.000Z')
  })

  it('defaults now to current time when omitted', () => {
    const before = Date.now()
    const d = decideCreateBooking({ priceSek: 0, autoAccept: false })
    const after = Date.now()
    // expiresAt should be ~7 days from now
    const expiresMs = new Date(d.expiresAt!).getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000)
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000)
  })
})

// ---------------------------------------------------------------------------
// validateBookingDate — code-first assertions (stronger than string checks)
// ---------------------------------------------------------------------------

describe('validateBookingDate', () => {
  const TODAY = '2026-04-22'
  const FUTURE = '2026-12-01'
  const PAST = '2020-01-01'

  it('returns valid: true for a valid future date', () => {
    const result = validateBookingDate(FUTURE, [], TODAY)
    expect(result.valid).toBe(true)
  })

  it('returns booking.date.required when dateStr is empty', () => {
    const result = validateBookingDate('', [], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.required')
    }
  })

  it('returns booking.date.invalid_format for a badly-formatted date', () => {
    const result = validateBookingDate('01-01-2026', [], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.invalid_format')
    }
  })

  it('returns booking.date.invalid for an unparseable date', () => {
    const result = validateBookingDate('2026-13-99', [], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.invalid')
    }
  })

  it('returns booking.date.in_past for a past date', () => {
    const result = validateBookingDate(PAST, [], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.in_past')
    }
  })

  it('returns booking.date.already_booked when date is in bookedDates', () => {
    const result = validateBookingDate(FUTURE, [FUTURE], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.already_booked')
    }
  })

  it('returns booking.market_closed when opening hours say the market is closed', () => {
    // 2026-12-01 is Tuesday; market only opens Saturdays
    const openingHours = {
      rules: [
        {
          id: 'r1',
          type: 'weekly' as const,
          day_of_week: 6,
          anchor_date: null,
          open_time: '09:00',
          close_time: '15:00',
        },
      ],
      exceptions: [],
    }
    const result = validateBookingDate(FUTURE, [], TODAY, openingHours)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.market_closed')
    }
  })

  it('returns valid: true on an open day', () => {
    // 2026-12-05 is Saturday
    const openingHours = {
      rules: [
        {
          id: 'r1',
          type: 'weekly' as const,
          day_of_week: 6,
          anchor_date: null,
          open_time: '09:00',
          close_time: '15:00',
        },
      ],
      exceptions: [],
    }
    expect(validateBookingDate('2026-12-05', [], TODAY, openingHours).valid).toBe(true)
  })
})
