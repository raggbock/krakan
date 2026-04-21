'use client'

type Props = {
  name: string
  onNameChange: (value: string) => void
  plannedDate: string
  onPlannedDateChange: (value: string) => void
  useGps: boolean
  onUseGpsChange: (value: boolean) => void
}

export function RouteFormFields({
  name,
  onNameChange,
  plannedDate,
  onPlannedDateChange,
  useGps,
  onUseGpsChange,
}: Props) {
  return (
    <>
      {/* Route name */}
      <div className="mt-6">
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
          Namn på rundan
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="T.ex. Söndagsrundan Södermalm"
          className="w-full h-11 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
        />
      </div>

      {/* Planned date */}
      <div className="mt-4">
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
          Planerat datum (valfritt)
        </label>
        <input
          type="date"
          value={plannedDate}
          onChange={(e) => onPlannedDateChange(e.target.value)}
          className="w-full h-11 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
        />
      </div>

      {/* Start point toggle */}
      <div className="mt-4">
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
          Startpunkt
        </label>
        <div className="flex gap-1 bg-cream-warm rounded-xl p-1">
          <button
            onClick={() => onUseGpsChange(true)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${useGps ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
          >
            Min position (GPS)
          </button>
          <button
            onClick={() => onUseGpsChange(false)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${!useGps ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
          >
            Välj på kartan
          </button>
        </div>
      </div>
    </>
  )
}
