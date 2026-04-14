import type { OpeningHourRule, OpeningHourException } from './types'

export type TimeSlot = { open_time: string; close_time: string }

export type OpeningHoursResult = {
  isOpen: boolean
  hours: TimeSlot[]
  exception?: { reason: string | null }
}

export type UpcomingDate = {
  date: string
  hours: TimeSlot[]
}

function toDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

function weeksBetween(a: string, b: string): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const diff = toDate(b).getTime() - toDate(a).getTime()
  return Math.round(diff / msPerWeek)
}

export function checkOpeningHours(
  rules: OpeningHourRule[],
  exceptions: OpeningHourException[],
  dateStr: string,
): OpeningHoursResult {
  // 1. Check exceptions first
  const exception = exceptions.find((e) => e.date === dateStr)
  if (exception) {
    return { isOpen: false, hours: [], exception: { reason: exception.reason } }
  }

  const dayOfWeek = toDate(dateStr).getDay()
  const toSlot = (r: OpeningHourRule): TimeSlot => ({ open_time: r.open_time, close_time: r.close_time })

  // 2. Date rules (highest priority) — if any exist for this date, use only those
  const dateRules = rules.filter((r) => r.type === 'date' && r.anchor_date === dateStr)
  if (dateRules.length > 0) {
    return { isOpen: true, hours: dateRules.map(toSlot) }
  }

  // 3. Biweekly rules — anchor must fall on the same day of week to be valid
  const biweeklyRules = rules.filter((r) => {
    if (r.type !== 'biweekly' || r.day_of_week !== dayOfWeek || !r.anchor_date) return false
    if (toDate(r.anchor_date).getDay() !== r.day_of_week) return false
    const weeks = weeksBetween(r.anchor_date, dateStr)
    return weeks >= 0 && weeks % 2 === 0
  })
  if (biweeklyRules.length > 0) {
    return { isOpen: true, hours: biweeklyRules.map(toSlot) }
  }

  // 4. Weekly rules
  const weeklyRules = rules.filter((r) => r.type === 'weekly' && r.day_of_week === dayOfWeek)
  if (weeklyRules.length > 0) {
    return { isOpen: true, hours: weeklyRules.map(toSlot) }
  }

  return { isOpen: false, hours: [] }
}

export function getUpcomingOpenDates(
  rules: OpeningHourRule[],
  exceptions: OpeningHourException[],
  fromDate: string,
  days: number,
): UpcomingDate[] {
  const results: UpcomingDate[] = []
  const start = toDate(fromDate)

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const result = checkOpeningHours(rules, exceptions, dateStr)
    if (result.isOpen && result.hours.length > 0) {
      results.push({ date: dateStr, hours: result.hours })
    }
  }

  return results
}
