import { describe, it, expect } from 'vitest'
import { formatWeeklyHoursSummary } from './format-weekly-hours'

describe('formatWeeklyHoursSummary', () => {
  it('returns null for an empty array', () => {
    expect(formatWeeklyHoursSummary([])).toBeNull()
  })

  it('groups consecutive weekdays with the same time and Saturday separately', () => {
    const rules = [
      { type: 'weekly', dayOfWeek: 1, openTime: '10:00:00', closeTime: '18:00:00' },
      { type: 'weekly', dayOfWeek: 2, openTime: '10:00:00', closeTime: '18:00:00' },
      { type: 'weekly', dayOfWeek: 3, openTime: '10:00:00', closeTime: '18:00:00' },
      { type: 'weekly', dayOfWeek: 4, openTime: '10:00:00', closeTime: '18:00:00' },
      { type: 'weekly', dayOfWeek: 5, openTime: '10:00:00', closeTime: '18:00:00' },
      { type: 'weekly', dayOfWeek: 6, openTime: '10:00:00', closeTime: '14:00:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBe('Mån–fre 10–18, lör 10–14')
  })

  it('groups Saturday and Sunday (weekend only)', () => {
    const rules = [
      { type: 'weekly', dayOfWeek: 6, openTime: '10:00:00', closeTime: '16:00:00' },
      { type: 'weekly', dayOfWeek: 0, openTime: '10:00:00', closeTime: '16:00:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBe('Lör–sön 10–16')
  })

  it('does not group non-consecutive days', () => {
    const rules = [
      { type: 'weekly', dayOfWeek: 2, openTime: '10:00:00', closeTime: '18:00:00' },
      { type: 'weekly', dayOfWeek: 5, openTime: '10:00:00', closeTime: '16:00:00' },
      { type: 'weekly', dayOfWeek: 6, openTime: '10:00:00', closeTime: '14:00:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBe('Tis 10–18, fre 10–16, lör 10–14')
  })

  it('ignores date-type rules and uses only weekly rules', () => {
    const rules = [
      { type: 'date', dayOfWeek: null, openTime: '09:00:00', closeTime: '17:00:00' },
      { type: 'weekly', dayOfWeek: 3, openTime: '10:00:00', closeTime: '18:00:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBe('Ons 10–18')
  })

  it('returns null when only biweekly rules are present', () => {
    const rules = [
      { type: 'biweekly', dayOfWeek: 6, openTime: '10:00:00', closeTime: '15:00:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBeNull()
  })

  it('renders non-zero minutes with a period (Swedish convention)', () => {
    const rules = [
      { type: 'weekly', dayOfWeek: 1, openTime: '10:30:00', closeTime: '17:45:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBe('Mån 10.30–17.45')
  })

  it('does not group consecutive days that differ in time', () => {
    const rules = [
      { type: 'weekly', dayOfWeek: 1, openTime: '09:00:00', closeTime: '17:00:00' },
      { type: 'weekly', dayOfWeek: 2, openTime: '10:00:00', closeTime: '18:00:00' },
    ]
    expect(formatWeeklyHoursSummary(rules)).toBe('Mån 9–17, tis 10–18')
  })
})
