'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { geo } from '@/lib/api'
import type { FleaMarketNearBy } from '@/lib/api'
import { FyndstigenLogo } from './fyndstigen-logo'

// Custom marker using a warm rust-colored SVG
const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`

const icon = new L.Icon({
  iconUrl: `data:image/svg+xml,${encodeURIComponent(markerSvg)}`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
})

const DEFAULT_CENTER = { lat: 59.33, lng: 18.07 } // Stockholm fallback

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 11, { duration: 1.2 })
  }, [map, lat, lng])
  return null
}

export default function MapView() {
  const [markets, setMarkets] = useState<FleaMarketNearBy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [center, setCenter] = useState(DEFAULT_CENTER)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCenter(loc)
        loadMarkets(loc.lat, loc.lng)
      },
      () => {
        // Geolocation denied or unavailable — use default
        loadMarkets(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng)
      },
      { timeout: 5000 },
    )

    function loadMarkets(lat: number, lng: number) {
      geo.nearbyMarkets({ lat, lng }, 60)
        .then((data) => setMarkets(data ?? []))
        .catch(() => setError('Kunde inte ladda loppisar'))
        .finally(() => setLoading(false))
    }
  }, [])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* Map header */}
      <div className="bg-card border-b border-cream-warm px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold">Karta</h1>
          <p className="text-xs text-espresso/60">
            {error ? error : `${markets.length} loppisar i närheten`}
          </p>
        </div>
        {loading && (
          <FyndstigenLogo size={24} className="text-rust animate-bob" />
        )}
      </div>

      {/* Map */}
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={11}
        className="flex-1 w-full"
        style={{ minHeight: '300px' }}
      >
        <FlyToLocation lat={center.lat} lng={center.lng} />
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
                <p className="text-xs text-espresso/65 mt-1">{market.city}</p>
                {market.description && (
                  <p className="text-xs text-espresso/60 mt-1 line-clamp-2">
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
