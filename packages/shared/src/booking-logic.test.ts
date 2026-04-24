import { describe, it, expect } from 'vitest'
import {
  calculateCommission,
  validateBookingDate,
  isValidStatusTransition,
  generateBatchLabels,
} from '@fyndstigen/shared'
import type { OpeningHoursContext } from '@fyndstigen/shared'
// Note: .error field was removed from BookingDateValidation — tests assert on .code instead.

describe('calculateCommission', () => {
  it('calculates 12% commission', () => {
    expect(calculateCommission(200)).toBe(24)
  })

  it('rounds to nearest whole SEK', () => {
    expect(calculateCommission(250)).toBe(30)
    expect(calculateCommission(175)).toBe(21) // 175 * 0.12 = 21
    expect(calculateCommission(133)).toBe(16) // 133 * 0.12 = 15.96 → 16
  })

  it('returns 0 for free table', () => {
    expect(calculateCommission(0)).toBe(0)
  })

  it('throws on negative price', () => {
    expect(() => calculateCommission(-100)).toThrow('Price cannot be negative')
  })

  it('accepts custom rate', () => {
    expect(calculateCommission(200, 0.15)).toBe(30)
    expect(calculateCommission(200, 0)).toBe(0)
    expect(calculateCommission(200, 1)).toBe(200)
  })

  it('throws on invalid rate', () => {
    expect(() => calculateCommission(200, -0.1)).toThrow()
    expect(() => calculateCommission(200, 1.5)).toThrow()
  })

  it('handles large prices correctly', () => {
    expect(calculateCommission(10000)).toBe(1200)
    expect(calculateCommission(9999)).toBe(1200) // 9999 * 0.12 = 1199.88 → 1200
  })
})

describe('validateBookingDate', () => {
  const today = '2026-04-07'

  it('accepts a valid future date', () => {
    expect(validateBookingDate('2026-04-10', [], today)).toEqual({ valid: true })
  })

  it('accepts today', () => {
    expect(validateBookingDate('2026-04-07', [], today)).toEqual({ valid: true })
  })

  it('rejects empty date', () => {
    const result = validateBookingDate('', [], today)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('booking.date.required')
  })

  it('rejects invalid format', () => {
    expect(validateBookingDate('07-04-2026', [], today).valid).toBe(false)
    expect(validateBookingDate('2026/04/07', [], today).valid).toBe(false)
    expect(validateBookingDate('not-a-date', [], today).valid).toBe(false)
  })

  it('rejects past dates', () => {
    const result = validateBookingDate('2026-04-05', [], today)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('booking.date.in_past')
  })

  it('rejects already booked dates', () => {
    const result = validateBookingDate('2026-04-10', ['2026-04-10', '2026-04-12'], today)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('booking.date.already_booked')
  })

  it('accepts date not in booked list', () => {
    const result = validateBookingDate('2026-04-11', ['2026-04-10', '2026-04-12'], today)
    expect(result.valid).toBe(true)
  })

  it('rejects impossible dates like feb 30 (caught as past date)', () => {
    // Feb 30 passes format regex but is in the past relative to today (April 7)
    // so it's rejected — the important thing is it IS rejected
    const result = validateBookingDate('2026-02-30', [], today)
    expect(result.valid).toBe(false)
  })

  describe('with opening hours context', () => {
    // 2026-04-10 is a Friday (day 5)
    const saturdayOnlyContext: OpeningHoursContext = {
      rules: [
        {
          id: 'r1',
          type: 'weekly',
          day_of_week: 6, // Saturday
          anchor_date: null,
          open_time: '09:00',
          close_time: '15:00',
        },
      ],
      exceptions: [],
    }

    it('rejects a date when market is closed (Friday vs Saturday-only market)', () => {
      // 2026-04-10 is a Friday
      const result = validateBookingDate('2026-04-10', [], today, saturdayOnlyContext)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.code).toBe('booking.market_closed')
    })

    it('accepts a date when market is open (Saturday)', () => {
      // 2026-04-11 is a Saturday
      const result = validateBookingDate('2026-04-11', [], today, saturdayOnlyContext)
      expect(result.valid).toBe(true)
    })

    it('rejects a date that is an exception (closed day)', () => {
      const exceptionContext: OpeningHoursContext = {
        rules: [
          {
            id: 'r1',
            type: 'weekly',
            day_of_week: 6,
            anchor_date: null,
            open_time: '09:00',
            close_time: '15:00',
          },
        ],
        exceptions: [{ id: 'e1', date: '2026-04-11', reason: 'Stängt för helgdag' }],
      }
      // 2026-04-11 is a Saturday but it is an exception (closed)
      const result = validateBookingDate('2026-04-11', [], today, exceptionContext)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.code).toBe('booking.market_closed')
    })

    it('preserves existing past-date check before opening-hours check', () => {
      // Past date should fail before opening-hours is even checked
      const result = validateBookingDate('2026-04-05', [], today, saturdayOnlyContext)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.code).toBe('booking.date.in_past')
    })

    it('preserves existing already-booked check before opening-hours check', () => {
      // 2026-04-11 is Saturday (open), but it is already booked
      const result = validateBookingDate('2026-04-11', ['2026-04-11'], today, saturdayOnlyContext)
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.code).toBe('booking.date.already_booked')
    })

    it('without opening hours context preserves old behaviour (open day)', () => {
      // No context → passes even on a closed day
      const result = validateBookingDate('2026-04-10', [], today)
      expect(result.valid).toBe(true)
    })
  })
})

describe('isValidStatusTransition', () => {
  it('allows pending → confirmed', () => {
    expect(isValidStatusTransition('pending', 'confirmed')).toBe(true)
  })

  it('allows pending → denied', () => {
    expect(isValidStatusTransition('pending', 'denied')).toBe(true)
  })

  it('allows pending → cancelled', () => {
    expect(isValidStatusTransition('pending', 'cancelled')).toBe(true)
  })

  it('allows confirmed → cancelled', () => {
    expect(isValidStatusTransition('confirmed', 'cancelled')).toBe(true)
  })

  it('disallows confirmed → denied', () => {
    expect(isValidStatusTransition('confirmed', 'denied')).toBe(false)
  })

  it('disallows confirmed → pending', () => {
    expect(isValidStatusTransition('confirmed', 'pending')).toBe(false)
  })

  it('disallows denied → anything', () => {
    expect(isValidStatusTransition('denied', 'confirmed')).toBe(false)
    expect(isValidStatusTransition('denied', 'pending')).toBe(false)
    expect(isValidStatusTransition('denied', 'cancelled')).toBe(false)
  })

  it('disallows cancelled → anything', () => {
    expect(isValidStatusTransition('cancelled', 'confirmed')).toBe(false)
    expect(isValidStatusTransition('cancelled', 'pending')).toBe(false)
    expect(isValidStatusTransition('cancelled', 'denied')).toBe(false)
  })

  it('disallows same-status transition', () => {
    expect(isValidStatusTransition('pending', 'pending')).toBe(false)
    expect(isValidStatusTransition('confirmed', 'confirmed')).toBe(false)
  })
})

describe('generateBatchLabels', () => {
  it('generates numbered labels', () => {
    expect(generateBatchLabels('Bord', 3)).toEqual(['Bord 1', 'Bord 2', 'Bord 3'])
  })

  it('respects startAt offset', () => {
    expect(generateBatchLabels('Bord', 3, 5)).toEqual(['Bord 5', 'Bord 6', 'Bord 7'])
  })

  it('generates single label', () => {
    expect(generateBatchLabels('Plats', 1)).toEqual(['Plats 1'])
  })

  it('trims prefix whitespace', () => {
    expect(generateBatchLabels('  Bord  ', 2)).toEqual(['Bord 1', 'Bord 2'])
  })

  it('throws on count < 1', () => {
    expect(() => generateBatchLabels('Bord', 0)).toThrow()
    expect(() => generateBatchLabels('Bord', -1)).toThrow()
  })

  it('throws on count > 100', () => {
    expect(() => generateBatchLabels('Bord', 101)).toThrow()
  })

  it('throws on empty prefix', () => {
    expect(() => generateBatchLabels('', 5)).toThrow()
    expect(() => generateBatchLabels('   ', 5)).toThrow()
  })
})
