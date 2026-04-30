'use client'

/**
 * block-sale-map-inner — Leaflet map showing approved stands for a kvartersloppis.
 * Loaded client-side only via dynamic() in block-sale-public-map.tsx.
 */

import { FyndstigenMap, type MapMarker } from './fyndstigen-map'

type Stand = {
  id: string
  street: string
  city: string
  description: string
  latitude: number | null
  longitude: number | null
}

type Props = {
  stands: Stand[]
  center: { lat: number; lng: number } | null
  onSelect: (id: string) => void
}

const SWEDEN_CENTER: [number, number] = [59.33, 18.07]

export default function BlockSaleMapInner({ stands, center, onSelect }: Props) {
  const pinned = stands.filter(
    (s): s is Stand & { latitude: number; longitude: number } =>
      s.latitude !== null && s.longitude !== null,
  )

  const markers: MapMarker[] = pinned.map((stand) => ({
    id: stand.id,
    coord: [stand.latitude, stand.longitude],
    icon: 'block_sale' as const,
    popup: (
      <div className="min-w-[180px] p-1">
        <p className="font-display font-bold text-sm text-espresso">{stand.street}</p>
        {stand.description && (
          <p className="text-xs text-espresso/65 mt-1 line-clamp-2">{stand.description}</p>
        )}
        <button
          onClick={() => onSelect(stand.id)}
          className="inline-block mt-2 text-xs font-semibold transition-colors"
          style={{ color: '#7c3aed' }}
        >
          Visa stånd &rarr;
        </button>
      </div>
    ),
  }))

  // Compute a sensible center: passed center > mean of pins > Stockholm fallback
  const mapCenter: [number, number] = center
    ? [center.lat, center.lng]
    : pinned.length > 0
      ? [
          pinned.reduce((s, p) => s + p.latitude, 0) / pinned.length,
          pinned.reduce((s, p) => s + p.longitude, 0) / pinned.length,
        ]
      : SWEDEN_CENTER

  return (
    <div>
      <div className="w-full rounded-card overflow-hidden" style={{ height: '400px' }}>
        <FyndstigenMap
          markers={markers}
          center={mapCenter}
          zoom={15}
          cluster={false}
          className="h-full w-full"
        />
      </div>
      {/* Stand list below the map for accessibility */}
      <ul className="grid gap-3 sm:grid-cols-2 mt-4">
        {stands.map((stand) => (
          <li key={stand.id}>
            <button
              onClick={() => onSelect(stand.id)}
              className="w-full text-left bg-card border border-cream-warm rounded-card px-4 py-3 hover:border-[#7c3aed]/40 hover:bg-parchment-light transition-colors group"
            >
              <p className="font-semibold text-espresso group-hover:text-[#7c3aed] transition-colors">
                {stand.street}
              </p>
              {stand.description && (
                <p className="text-espresso/65 text-sm mt-0.5 line-clamp-2">{stand.description}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
