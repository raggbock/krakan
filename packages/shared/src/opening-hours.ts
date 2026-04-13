import type { OpeningHourRule, OpeningHourException } from './types'

export type OpeningHoursResult = {
  isOpen: boolean
  hours: { open_time: string; close_time: string } | null
  exception?: { reason: string | null }
}

export type UpcomingDate = {
  date: string
  open_time: string
  close_time: string
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
    return { isOpen: false, hours: null, exception: { reason: exception.reason } }
  }

  const dayOfWeek = toDate(dateStr).getDay()

  // 2. Date rules (highest priority)
  const dateRule = rules.find((r) => r.type === 'date' && r.anchor_date === dateStr)
  if (dateRule) {
    return { isOpen: true, hours: { open_time: dateRule.open_time, close_time: dateRule.close_time } }
  }

  // 3. Biweekly rules
  const biweeklyRule = rules.find((r) => {
    if (r.type !== 'biweekly' || r.day_of_week !== dayOfWeek || !r.anchor_date) return false
    const weeks = weeksBetween(r.anchor_date, dateStr)
    return weeks >= 0 && weeks % 2 === 0
  })
  if (biweeklyRule) {
    return { isOpen: true, hours: { open_time: biweeklyRule.open_time, close_time: biweeklyRule.close_time } }
  }

  // 4. Weekly rules
  const weeklyRule = rules.find((r) => r.type === 'weekly' && r.day_of_week === dayOfWeek)
  if (weeklyRule) {
    return { isOpen: true, hours: { open_time: weeklyRule.open_time, close_time: weeklyRule.close_time } }
  }

  return { isOpen: false, hours: null }
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
    if (result.isOpen && result.hours) {
      results.push({ date: dateStr, open_time: result.hours.open_time, close_time: result.hours.close_time })
    }
  }

  return results
}
