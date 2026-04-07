'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, FleaMarketNearBy } from '@/lib/api'
import { KrakanLogo } from './krakan-logo'

// Custom marker using a warm rust-colored SVG
const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`

const icon = new L.Icon({
  iconUrl: `data:image/svg+xml,${encodeURIComponent(markerSvg)}`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
})

export default function MapView() {
  const [markets, setMarkets] = useState<FleaMarketNearBy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.fleaMarkets
      .nearBy({ latitude: 59.3293, longitude: 18.0686, radiusKm: 60 })
      .then((data) => setMarkets(data ?? []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Map header */}
      <div className="bg-card border-b border-cream-warm px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold">Karta</h1>
          <p className="text-xs text-espresso/40">
            {markets.length} loppisar i närheten
          </p>
        </div>
        {loading && (
          <KrakanLogo size={24} className="text-rust animate-bob" />
        )}
      </div>

      {/* Map */}
      <MapContainer
        center={[59.3293, 18.0686]}
        zoom={11}
        className="flex-1 w-full"
        style={{ minHeight: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markets.map((market) => (
          <Marker
            key={market.id}
            position={[market.latitude, market.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="min-w-[200px] p-1">
                <p className="font-display font-bold text-sm text-espresso">
                  {market.name}
                </p>
                <p className="text-xs text-espresso/50 mt-1">{market.city}</p>
                {market.description && (
                  <p className="text-xs text-espresso/40 mt-1 line-clamp-2">
                    {market.description}
                  </p>
                )}
                <Link
                  href={`/fleamarkets/${market.id}`}
                  className="inline-block mt-2 text-xs text-rust font-semibold hover:text-rust-light transition-colors"
                >
                  Visa loppis &rarr;
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
