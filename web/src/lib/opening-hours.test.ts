import { describe, it, expect } from 'vitest'
import { checkOpeningHours, type OpeningHoursEntry } from '@fyndstigen/shared'

describe('checkOpeningHours', () => {
  // Monday = 1 in JS Date.getDay(), but our DB uses 0=Sunday..6=Saturday
  const mondayDate = '2026-04-13' // a Monday

  it('returns closed with no hours', () => {
    const result = checkOpeningHours([], mondayDate)
    expect(result.isOpen).toBe(false)
    expect(result.hours).toBeNull()
  })

  it('returns open for permanent market on matching day', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: 1, date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // Monday = day_of_week 1
    const result = checkOpeningHours(hours, mondayDate)
    expect(result.isOpen).toBe(true)
    expect(result.hours).toEqual({ open_time: '10:00', close_time: '16:00' })
  })

  it('returns closed for permanent market on non-matching day', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: 2, date: null, open_time: '10:00', close_time: '16:00' }, // Tuesday only
    ]
    const result = checkOpeningHours(hours, mondayDate)
    expect(result.isOpen).toBe(false)
    expect(result.hours).toBeNull()
  })

  it('returns open for temporary market on matching date', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: null, date: '2026-04-13', open_time: '09:00', close_time: '15:00' },
    ]
    const result = checkOpeningHours(hours, '2026-04-13')
    expect(result.isOpen).toBe(true)
    expect(result.hours).toEqual({ open_time: '09:00', close_time: '15:00' })
  })

  it('returns closed for temporary market on non-matching date', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: null, date: '2026-04-14', open_time: '09:00', close_time: '15:00' },
    ]
    const result = checkOpeningHours(hours, '2026-04-13')
    expect(result.isOpen).toBe(false)
  })

  it('prefers specific date over day_of_week match', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: 1, date: null, open_time: '10:00', close_time: '16:00' },
      { day_of_week: null, date: '2026-04-13', open_time: '08:00', close_time: '14:00' },
    ]
    const result = checkOpeningHours(hours, mondayDate)
    expect(result.isOpen).toBe(true)
    // Specific date should win
    expect(result.hours).toEqual({ open_time: '08:00', close_time: '14:00' })
  })

  it('handles multiple day_of_week entries', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: 0, date: null, open_time: '11:00', close_time: '17:00' }, // Sunday
      { day_of_week: 1, date: null, open_time: '10:00', close_time: '16:00' }, // Monday
      { day_of_week: 6, date: null, open_time: '09:00', close_time: '18:00' }, // Saturday
    ]
    const result = checkOpeningHours(hours, mondayDate)
    expect(result.isOpen).toBe(true)
    expect(result.hours).toEqual({ open_time: '10:00', close_time: '16:00' })
  })

  it('works for Sunday (day_of_week = 0)', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: 0, date: null, open_time: '12:00', close_time: '16:00' },
    ]
    // 2026-04-12 is a Sunday
    const result = checkOpeningHours(hours, '2026-04-12')
    expect(result.isOpen).toBe(true)
  })

  it('works for Saturday (day_of_week = 6)', () => {
    const hours: OpeningHoursEntry[] = [
      { day_of_week: 6, date: null, open_time: '08:00', close_time: '15:00' },
    ]
    // 2026-04-11 is a Saturday
    const result = checkOpeningHours(hours, '2026-04-11')
    expect(result.isOpen).toBe(true)
  })
})
