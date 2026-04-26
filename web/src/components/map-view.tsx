'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMap } from 'react-leaflet'
import { geo } from '@/lib/api'
import type { FleaMarketNearBy } from '@/lib/api'
import { FyndstigenLogo } from './fyndstigen-logo'
import { FyndstigenMap, type MapMarker } from './fyndstigen-map'

const DEFAULT_CENTER: [number, number] = [59.33, 18.07] // Stockholm fallback

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
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setCenter(loc)
        loadMarkets(loc[0], loc[1])
      },
      () => {
        // Geolocation denied or unavailable — use default
        loadMarkets(DEFAULT_CENTER[0], DEFAULT_CENTER[1])
      },
      { timeout: 5000 },
    )

    function loadMarkets(lat: number, lng: number) {
      // Sweden's longest extent is ~1500km. A national radius lets users
      // see every market in the country regardless of where they are —
      // 60km hid all but one for a user in Örebro once chain stores were
      // imported. Leaflet's clustering handles dense areas just fine.
      geo.nearbyMarkets({ lat, lng }, 2000)
        .then((data) => setMarkets(data ?? []))
        .catch(() => setError('Kunde inte ladda loppisar'))
        .finally(() => setLoading(false))
    }
  }, [])

  const markers: MapMarker[] = markets.map((market) => ({
    id: market.id,
    coord: [market.latitude, market.longitude],
    icon: 'market',
    popup: (
      <div className="min-w-[200px] p-1">
        <p className="font-display font-bold text-sm text-espresso">{market.name}</p>
        <p className="text-xs text-espresso/65 mt-1">{market.city}</p>
        {market.description && (
          <p className="text-xs text-espresso/60 mt-1 line-clamp-2">{market.description}</p>
        )}
        <Link
          href={`/fleamarkets/${market.id}`}
          className="inline-block mt-2 text-xs text-rust font-semibold hover:text-rust-light transition-colors"
        >
          Visa loppis &rarr;
        </Link>
      </div>
    ),
  }))

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
      <FyndstigenMap
        markers={markers}
        center={DEFAULT_CENTER}
        zoom={11}
        cluster
        className="flex-1 w-full"
      >
        <FlyToLocation lat={center[0]} lng={center[1]} />
      </FyndstigenMap>
    </div>
  )
}
