/**
 * Formats a compact weekly opening hours summary from opening hour rules.
 * Returns null if there are no weekly rules.
 *
 * Examples:
 *   All weekdays 10–18 + Sat 10–14 → "Mån–fre 10–18, lör 10–14"
 *   Sat–Sun 10–16                  → "Lör–sön 10–16"
 *   Non-consecutive days           → "Tis 10–18, fre 10–16, lör 10–14"
 */

// Swedish short day names indexed by dayOfWeek (0=Sun … 6=Sat)
const SV_DAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör']

// Swedish week order: Mon(1)…Sat(6), Sun(0) — Sunday sorts last
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

function weekPos(dayOfWeek: number): number {
  return WEEK_ORDER.indexOf(dayOfWeek)
}

/** Formats a time string like "10:00:00" → "10", "10:30:00" → "10.30" */
function formatTime(timeStr: string): string {
  // timeStr is HH:MM:SS or HH:MM
  const [h, m] = timeStr.split(':')
  const hours = h.replace(/^0/, '') || '0'
  const mins = (m ?? '00').padStart(2, '0')
  if (mins === '00') return hours
  return `${hours}.${mins}`
}

export function formatWeeklyHoursSummary(
  rules: Array<{ type: string; dayOfWeek: number | null; openTime: string; closeTime: string }>
): string | null {
  // Filter to weekly rules only; skip biweekly and date
  const weekly = rules.filter((r) => r.type === 'weekly' && r.dayOfWeek !== null)
  if (weekly.length === 0) return null

  // Sort by Swedish week order
  const sorted = [...weekly].sort((a, b) => weekPos(a.dayOfWeek!) - weekPos(b.dayOfWeek!))

  // Group consecutive days with identical openTime + closeTime
  type Group = { days: number[]; openTime: string; closeTime: string }
  const groups: Group[] = []

  for (const rule of sorted) {
    const last = groups[groups.length - 1]
    const sameTime = last && last.openTime === rule.openTime && last.closeTime === rule.closeTime
    const lastDay = last?.days[last.days.length - 1]
    const isConsecutive =
      last !== undefined &&
      lastDay !== undefined &&
      weekPos(rule.dayOfWeek!) === weekPos(lastDay) + 1

    if (sameTime && isConsecutive) {
      last.days.push(rule.dayOfWeek!)
    } else {
      groups.push({ days: [rule.dayOfWeek!], openTime: rule.openTime, closeTime: rule.closeTime })
    }
  }

  // Render each group
  const parts = groups.map((g) => {
    let dayPart: string
    if (g.days.length === 1) {
      dayPart = SV_DAYS[g.days[0]]
    } else {
      dayPart = `${SV_DAYS[g.days[0]]}–${SV_DAYS[g.days[g.days.length - 1]]}`
    }
    const timePart = `${formatTime(g.openTime)}–${formatTime(g.closeTime)}`
    return `${dayPart} ${timePart}`
  })

  const joined = parts.join(', ')
  // Capitalize first letter only
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}
