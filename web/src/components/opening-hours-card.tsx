import type { OpeningHourRuleView, OpeningHourExceptionView } from '@fyndstigen/shared'
import { getUpcomingOpenDates } from '@fyndstigen/shared'
import { DAY_NAMES } from '@/components/opening-hours-editor'

function formatRuleSummary(rule: OpeningHourRuleView, upcoming: { date: string }[]): string {
  if (rule.type === 'weekly') return `Varje ${DAY_NAMES[rule.dayOfWeek!]?.toLowerCase()}`
  if (rule.type === 'biweekly') {
    const next = upcoming.find((u) => {
      const d = new Date(u.date + 'T12:00:00')
      return d.getDay() === rule.dayOfWeek && d > new Date()
    })
    const nextStr = next
      ? ` (nästa: ${new Date(next.date + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })})`
      : ''
    return `Varannan ${DAY_NAMES[rule.dayOfWeek!]?.toLowerCase()}${nextStr}`
  }
  return new Date(rule.anchorDate + 'T12:00:00').toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatExceptionDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
  })
}

export function OpeningHoursCard({
  rules,
  exceptions,
}: {
  rules: OpeningHourRuleView[]
  exceptions: OpeningHourExceptionView[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = getUpcomingOpenDates(rules, exceptions, today, 90)

  const recurringRules = rules.filter((r) => r.type === 'weekly' || r.type === 'biweekly')
  const oneOffRules = rules.filter((r) => r.type !== 'weekly' && r.type !== 'biweekly')

  // Cut-off for "near" exceptions worth surfacing as an inline notice on the
  // weekly row. Two weeks keeps the line from getting noisy on permanent
  // markets that rack up lots of exceptions over the year.
  const HORIZON_DAYS = 14
  const horizonDate = (() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + HORIZON_DAYS)
    return d.toISOString().slice(0, 10)
  })()

  // Group near-term exceptions by the weekday they fall on so each weekly
  // row can show only the exceptions that actually affect it.
  const nearExceptionsByDow = new Map<number, OpeningHourExceptionView[]>()
  const orphanExceptions: OpeningHourExceptionView[] = []
  for (const ex of exceptions) {
    if (ex.date < today || ex.date > horizonDate) continue
    const dow = new Date(ex.date + 'T12:00:00').getDay()
    const matchesWeekly = recurringRules.some((r) => r.dayOfWeek === dow)
    if (matchesWeekly) {
      const list = nearExceptionsByDow.get(dow) ?? []
      list.push(ex)
      nearExceptionsByDow.set(dow, list)
    } else {
      orphanExceptions.push(ex)
    }
  }

  // One row per (rule-type, dayOfWeek, anchor) — merging multiple time ranges
  // into a comma-joined list ("10-13, 14-18").
  type WeeklyRow = {
    key: string
    label: string
    times: string[]
    dayOfWeek: number | null
  }
  const weeklyRows: WeeklyRow[] = []
  {
    const groups = new Map<string, WeeklyRow>()
    for (const rule of recurringRules) {
      const key = `${rule.type}-${rule.dayOfWeek}-${rule.anchorDate ?? ''}`
      const time = `${rule.openTime.slice(0, 5)} – ${rule.closeTime.slice(0, 5)}`
      const existing = groups.get(key)
      if (existing) {
        existing.times.push(time)
      } else {
        const row: WeeklyRow = {
          key,
          label: formatRuleSummary(rule, upcoming),
          times: [time],
          dayOfWeek: rule.dayOfWeek ?? null,
        }
        groups.set(key, row)
        weeklyRows.push(row)
      }
    }
  }

  const oneOffRows = oneOffRules.map((r) => ({
    key: `oneoff-${r.id}`,
    label: formatRuleSummary(r, upcoming),
    time: `${r.openTime.slice(0, 5)} – ${r.closeTime.slice(0, 5)}`,
  }))

  const hasAnyContent =
    weeklyRows.length > 0 || oneOffRows.length > 0 || orphanExceptions.length > 0

  if (!hasAnyContent) return null

  return (
    <div className="vintage-card p-6">
      <h2 className="font-display text-lg font-bold text-espresso mb-4">Öppettider</h2>

      {weeklyRows.length > 0 && (
        <div className="space-y-3">
          {weeklyRows.map((row) => {
            const dowExceptions = row.dayOfWeek != null ? nearExceptionsByDow.get(row.dayOfWeek) ?? [] : []
            return (
              <div key={row.key}>
                <div className="flex justify-between items-center">
                  <span className="text-espresso">{row.label}</span>
                  <span className="font-medium tabular-nums text-espresso">
                    {row.times.join(', ')}
                  </span>
                </div>
                {dowExceptions.length > 0 && (
                  <ul className="mt-1 ml-1 space-y-0.5 text-xs text-rust/85">
                    {dowExceptions.map((ex) => (
                      <li key={ex.id}>
                        Stängt {formatExceptionDate(ex.date)}
                        {ex.reason ? ` (${ex.reason})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {oneOffRows.length > 0 && (
        <div className={`space-y-1 ${weeklyRows.length > 0 ? 'mt-4 pt-4 border-t border-cream-warm' : ''}`}>
          {weeklyRows.length > 0 && (
            <p className="text-sm font-semibold text-espresso/75 mb-2">Specialdagar</p>
          )}
          {oneOffRows.map((r) => (
            <div key={r.key} className="flex justify-between items-center">
              <span className="text-espresso">{r.label}</span>
              <span className="font-medium tabular-nums text-espresso">{r.time}</span>
            </div>
          ))}
        </div>
      )}

      {orphanExceptions.length > 0 && (
        <div className={`space-y-1 ${weeklyRows.length > 0 || oneOffRows.length > 0 ? 'mt-4 pt-4 border-t border-cream-warm' : ''}`}>
          <p className="text-sm font-semibold text-espresso/75 mb-2">Kommande avvikelser</p>
          {orphanExceptions.map((ex) => (
            <div key={ex.id} className="flex justify-between items-center text-sm">
              <span className="text-espresso">
                {new Date(ex.date + 'T12:00:00').toLocaleDateString('sv-SE', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <span className="text-rust font-medium">
                Stängt{ex.reason ? ` (${ex.reason})` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
