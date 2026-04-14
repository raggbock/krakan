import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'
import { getUpcomingOpenDates } from '@fyndstigen/shared'

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

function formatRuleSummary(rule: OpeningHourRule, upcoming: { date: string }[]): string {
  if (rule.type === 'weekly') return `Varje ${DAY_NAMES[rule.day_of_week!]?.toLowerCase()}`
  if (rule.type === 'biweekly') {
    const next = upcoming.find((u) => {
      const d = new Date(u.date + 'T12:00:00')
      return d.getDay() === rule.day_of_week && d > new Date()
    })
    const nextStr = next
      ? ` (nästa: ${new Date(next.date + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })})`
      : ''
    return `Varannan ${DAY_NAMES[rule.day_of_week!]?.toLowerCase()}${nextStr}`
  }
  return new Date(rule.anchor_date + 'T12:00:00').toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function OpeningHoursCard({
  rules,
  exceptions,
}: {
  rules: OpeningHourRule[]
  exceptions: OpeningHourException[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = getUpcomingOpenDates(rules, exceptions, today, 90)

  const recurringRules = rules.filter((r) => r.type === 'weekly' || r.type === 'biweekly')

  // Build upcoming list including exceptions for display
  const upcomingWithExceptions = (() => {
    const dates = upcoming.slice(0, 10).map((u) => ({ ...u, closed: false, reason: null as string | null }))
    for (const ex of exceptions) {
      if (ex.date >= today && !dates.find((d) => d.date === ex.date)) {
        dates.push({ date: ex.date, open_time: '', close_time: '', closed: true, reason: ex.reason })
      }
    }
    dates.sort((a, b) => a.date.localeCompare(b.date))
    return dates.slice(0, 10)
  })()

  return (
    <div className="vintage-card p-6">
      <h2 className="font-display text-lg font-bold text-espresso mb-4">Öppettider</h2>

      {recurringRules.length > 0 && (
        <div className="space-y-2 mb-4">
          {recurringRules.map((rule) => (
            <div key={rule.id} className="flex justify-between items-center">
              <span className="text-espresso">{formatRuleSummary(rule, upcoming)}</span>
              <span className="font-medium tabular-nums text-espresso">
                {rule.open_time.slice(0, 5)} – {rule.close_time.slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      )}

      {upcomingWithExceptions.length > 0 && (
        <div>
          {recurringRules.length > 0 && (
            <p className="text-sm font-semibold text-espresso/60 mb-2 mt-4">Kommande tillfällen</p>
          )}
          <div className="space-y-1">
            {upcomingWithExceptions.map((d) => (
              <div key={d.date} className="flex justify-between items-center text-sm">
                <span className="text-espresso/80">
                  {new Date(d.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {d.closed ? (
                  <span className="text-rust font-medium">Stängt{d.reason ? ` (${d.reason})` : ''}</span>
                ) : (
                  <span className="tabular-nums text-espresso/80">{d.open_time.slice(0, 5)} – {d.close_time.slice(0, 5)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
