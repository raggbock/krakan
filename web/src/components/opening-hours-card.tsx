const DAY_NAMES = [
  'Söndag',
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
]

type OpeningHour = {
  day_of_week: number | null
  date: string | null
  open_time: string
  close_time: string
}

export function OpeningHoursCard({ hours }: { hours: OpeningHour[] }) {
  return (
    <div className="vintage-card p-6 animate-fade-up delay-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-forest/10 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-forest">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 4V8L10.5 10.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg mb-3">Öppettider</h2>
          <div className="space-y-2">
            {hours.map((oh, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-1.5 border-b border-cream-warm/60 last:border-0"
              >
                <span className="text-espresso/60 text-sm">
                  {oh.day_of_week != null ? DAY_NAMES[oh.day_of_week] : oh.date}
                </span>
                <span className="font-medium text-sm tabular-nums">
                  {oh.open_time} &ndash; {oh.close_time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
