import { describe, it, expect } from 'vitest'
import { checkOpeningHours, getUpcomingOpenDates } from '@fyndstigen/shared'
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'

describe('checkOpeningHours', () => {
  it('returns closed when no rules', () => {
    const result = checkOpeningHours([], [], '2026-04-19')
    expect(result).toEqual({ isOpen: false, hours: null })
  })

  it('matches weekly rule by day_of_week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // 2026-04-18 is a Saturday (day_of_week=6)
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '10:00', close_time: '16:00' } })
  })

  it('returns closed for non-matching weekly day', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // 2026-04-20 is a Monday
    const result = checkOpeningHours(rules, [], '2026-04-20')
    expect(result).toEqual({ isOpen: false, hours: null })
  })

  it('matches biweekly rule on anchor week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '10:00', close_time: '16:00' } })
  })

  it('matches biweekly rule two weeks after anchor', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-05-02')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '10:00', close_time: '16:00' } })
  })

  it('returns closed for biweekly on odd week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-25')
    expect(result).toEqual({ isOpen: false, hours: null })
  })

  it('matches date rule exactly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'date', day_of_week: null, anchor_date: '2026-07-04', open_time: '09:00', close_time: '14:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-07-04')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '09:00', close_time: '14:00' } })
  })

  it('date rule takes priority over weekly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
      { id: '2', type: 'date', day_of_week: null, anchor_date: '2026-04-18', open_time: '12:00', close_time: '14:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: { open_time: '12:00', close_time: '14:00' } })
  })

  it('exception overrides all rules', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-18', reason: 'Midsommar' },
    ]
    const result = checkOpeningHours(rules, exceptions, '2026-04-18')
    expect(result).toEqual({ isOpen: false, hours: null, exception: { reason: 'Midsommar' } })
  })

  it('exception with null reason', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-18', reason: null },
    ]
    const result = checkOpeningHours(rules, exceptions, '2026-04-18')
    expect(result).toEqual({ isOpen: false, hours: null, exception: { reason: null } })
  })
})

describe('getUpcomingOpenDates', () => {
  it('returns empty for no rules', () => {
    const result = getUpcomingOpenDates([], [], '2026-04-18', 14)
    expect(result).toEqual([])
  })

  it('returns weekly dates within range', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const result = getUpcomingOpenDates(rules, [], '2026-04-18', 14)
    expect(result).toEqual([
      { date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
      { date: '2026-04-25', open_time: '10:00', close_time: '16:00' },
    ])
  })

  it('skips exception dates', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-25', reason: null },
    ]
    const result = getUpcomingOpenDates(rules, exceptions, '2026-04-18', 14)
    expect(result).toEqual([
      { date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ])
  })

  it('includes biweekly dates correctly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = getUpcomingOpenDates(rules, [], '2026-04-18', 28)
    expect(result).toEqual([
      { date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
      { date: '2026-05-02', open_time: '10:00', close_time: '16:00' },
    ])
  })
})
