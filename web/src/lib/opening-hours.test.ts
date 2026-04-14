import { describe, it, expect } from 'vitest'
import { checkOpeningHours, getUpcomingOpenDates } from '@fyndstigen/shared'
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'

describe('checkOpeningHours', () => {
  it('returns closed when no rules', () => {
    const result = checkOpeningHours([], [], '2026-04-19')
    expect(result).toEqual({ isOpen: false, hours: [] })
  })

  it('matches weekly rule by day_of_week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // 2026-04-18 is a Saturday (day_of_week=6)
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: [{ open_time: '10:00', close_time: '16:00' }] })
  })

  it('returns closed for non-matching weekly day', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    // 2026-04-20 is a Monday
    const result = checkOpeningHours(rules, [], '2026-04-20')
    expect(result).toEqual({ isOpen: false, hours: [] })
  })

  it('matches biweekly rule on anchor week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: [{ open_time: '10:00', close_time: '16:00' }] })
  })

  it('matches biweekly rule two weeks after anchor', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-05-02')
    expect(result).toEqual({ isOpen: true, hours: [{ open_time: '10:00', close_time: '16:00' }] })
  })

  it('returns closed for biweekly on odd week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-25')
    expect(result).toEqual({ isOpen: false, hours: [] })
  })

  it('matches date rule exactly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'date', day_of_week: null, anchor_date: '2026-07-04', open_time: '09:00', close_time: '14:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-07-04')
    expect(result).toEqual({ isOpen: true, hours: [{ open_time: '09:00', close_time: '14:00' }] })
  })

  it('date rule takes priority over weekly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
      { id: '2', type: 'date', day_of_week: null, anchor_date: '2026-04-18', open_time: '12:00', close_time: '14:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: [{ open_time: '12:00', close_time: '14:00' }] })
  })

  it('exception overrides all rules', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-18', reason: 'Midsommar' },
    ]
    const result = checkOpeningHours(rules, exceptions, '2026-04-18')
    expect(result).toEqual({ isOpen: false, hours: [], exception: { reason: 'Midsommar' } })
  })

  it('exception with null reason', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
    ]
    const exceptions: OpeningHourException[] = [
      { id: 'e1', date: '2026-04-18', reason: null },
    ]
    const result = checkOpeningHours(rules, exceptions, '2026-04-18')
    expect(result).toEqual({ isOpen: false, hours: [], exception: { reason: null } })
  })

  it('returns multiple time slots for same day', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '12:00' },
      { id: '2', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '14:00', close_time: '17:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({
      isOpen: true,
      hours: [
        { open_time: '10:00', close_time: '12:00' },
        { open_time: '14:00', close_time: '17:00' },
      ],
    })
  })

  it('multiple date rules on same date', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'date', day_of_week: null, anchor_date: '2026-07-04', open_time: '09:00', close_time: '12:00' },
      { id: '2', type: 'date', day_of_week: null, anchor_date: '2026-07-04', open_time: '14:00', close_time: '17:00' },
    ]
    const result = checkOpeningHours(rules, [], '2026-07-04')
    expect(result).toEqual({
      isOpen: true,
      hours: [
        { open_time: '09:00', close_time: '12:00' },
        { open_time: '14:00', close_time: '17:00' },
      ],
    })
  })

  it('date rules replace weekly rules for that day', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
      { id: '2', type: 'date', day_of_week: null, anchor_date: '2026-04-18', open_time: '12:00', close_time: '14:00' },
      { id: '3', type: 'date', day_of_week: null, anchor_date: '2026-04-18', open_time: '15:00', close_time: '17:00' },
    ]
    // Date rules should override weekly, returning both date slots
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({
      isOpen: true,
      hours: [
        { open_time: '12:00', close_time: '14:00' },
        { open_time: '15:00', close_time: '17:00' },
      ],
    })
  })

  it('biweekly with anchor date in the past', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-03-07', open_time: '10:00', close_time: '16:00' },
    ]
    // 6 weeks after anchor = even, should match
    const result = checkOpeningHours(rules, [], '2026-04-18')
    expect(result).toEqual({ isOpen: true, hours: [{ open_time: '10:00', close_time: '16:00' }] })
  })

  it('biweekly with anchor date in the past on odd week', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-03-07', open_time: '10:00', close_time: '16:00' },
    ]
    // 7 weeks after anchor = odd, should not match
    const result = checkOpeningHours(rules, [], '2026-04-25')
    expect(result).toEqual({ isOpen: false, hours: [] })
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
      { date: '2026-04-18', hours: [{ open_time: '10:00', close_time: '16:00' }] },
      { date: '2026-04-25', hours: [{ open_time: '10:00', close_time: '16:00' }] },
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
      { date: '2026-04-18', hours: [{ open_time: '10:00', close_time: '16:00' }] },
    ])
  })

  it('includes biweekly dates correctly', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'biweekly', day_of_week: 6, anchor_date: '2026-04-18', open_time: '10:00', close_time: '16:00' },
    ]
    const result = getUpcomingOpenDates(rules, [], '2026-04-18', 28)
    expect(result).toEqual([
      { date: '2026-04-18', hours: [{ open_time: '10:00', close_time: '16:00' }] },
      { date: '2026-05-02', hours: [{ open_time: '10:00', close_time: '16:00' }] },
    ])
  })

  it('returns multiple time slots per date', () => {
    const rules: OpeningHourRule[] = [
      { id: '1', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '12:00' },
      { id: '2', type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '14:00', close_time: '17:00' },
    ]
    const result = getUpcomingOpenDates(rules, [], '2026-04-18', 7)
    expect(result).toEqual([
      { date: '2026-04-18', hours: [
        { open_time: '10:00', close_time: '12:00' },
        { open_time: '14:00', close_time: '17:00' },
      ]},
    ])
  })
})
