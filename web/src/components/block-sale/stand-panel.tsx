'use client'

type Stand = {
  id: string
  street: string
  city: string
  description: string
  latitude: number | null
  longitude: number | null
}

type Props = {
  stand: Stand
  onClose: () => void
}

export function BlockSaleStandPanel({ stand, onClose }: Props) {
  const mapsUrl =
    stand.latitude && stand.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${stand.latitude},${stand.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stand.street}, ${stand.city}`)}`

  return (
    <div
      id={`stand-${stand.id}`}
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-cream-warm rounded-t-2xl shadow-lg p-6 max-w-lg mx-auto sm:static sm:rounded-card sm:border sm:shadow-none"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="font-display text-lg font-semibold text-espresso">{stand.street}</h3>
        <button
          onClick={onClose}
          aria-label="Stäng"
          className="shrink-0 text-espresso/50 hover:text-espresso transition-colors text-xl leading-none"
        >
          ✕
        </button>
      </div>

      <p className="text-espresso/70 text-sm mb-1">{stand.city}</p>

      {stand.description && (
        <p className="text-espresso text-sm leading-relaxed mb-4">{stand.description}</p>
      )}

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-forest-light transition-colors"
      >
        Hitta hit →
      </a>
    </div>
  )
}
