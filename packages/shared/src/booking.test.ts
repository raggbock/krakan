import { describe, it, expect } from 'vitest'
import {
  isFreePriced,
  resolveBookingOutcome,
  validateBookingDate,
} from './booking'
import { messageFor } from './errors'

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
      // Backwards-compat: deprecated error string must match messageFor
      expect(result.error).toBe(messageFor('booking.date.required'))
    }
  })

  it('returns booking.date.invalid_format for a badly-formatted date', () => {
    const result = validateBookingDate('01-01-2026', [], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.invalid_format')
      expect(result.error).toBe(messageFor('booking.date.invalid_format'))
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
      expect(result.error).toBe(messageFor('booking.date.in_past'))
      // Display string check — codes are the real assertion
      expect(result.error).toContain('förflutna')
    }
  })

  it('returns booking.date.already_booked when date is in bookedDates', () => {
    const result = validateBookingDate(FUTURE, [FUTURE], TODAY)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('booking.date.already_booked')
      expect(result.error).toBe(messageFor('booking.date.already_booked'))
      expect(result.error).toContain('bokat')
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
      expect(result.error).toBe(messageFor('booking.market_closed'))
      expect(result.error).toContain('stängd')
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
