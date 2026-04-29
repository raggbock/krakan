'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMap } from 'react-leaflet'
import { geo } from '@/lib/api'
import type { FleaMarketNearBy } from '@fyndstigen/shared'
import { FyndstigenLogo } from './fyndstigen-logo'
import { FyndstigenMap, type MapMarker } from './fyndstigen-map'

const DEFAULT_CENTER: [number, number] = [59.33, 18.07] // Stockholm fallback

function FlyToLocation({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 1.2 })
  }, [map, lat, lng, zoom])
  return null
}

export default function MapView() {
  const params = useSearchParams()
  // Allow callers (e.g. /loppis/[slug]'s "Visa på karta"-link) to deep-link
  // straight to a market's coordinates instead of opening the general map
  // at the visitor's location. Falls back to geolocation when params absent.
  const targetLat = parseFloat(params.get('lat') ?? '')
  const targetLng = parseFloat(params.get('lng') ?? '')
  const hasTarget = Number.isFinite(targetLat) && Number.isFinite(targetLng)
  // Optional metadata for the target pin's popup so a draft market that
  // wouldn't otherwise show up in the nearby-markets feed still gets a
  // recognisable label + back-link.
  const targetName = params.get('name')
  const targetSlug = params.get('slug')

  const [markets, setMarkets] = useState<FleaMarketNearBy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [center, setCenter] = useState<[number, number]>(
    hasTarget ? [targetLat, targetLng] : DEFAULT_CENTER,
  )
  // Higher zoom when arriving at a specific market — visitor wants to see
  // the actual location, not a regional overview.
  const [zoom, setZoom] = useState(hasTarget ? 15 : 11)

  useEffect(() => {
    if (hasTarget) {
      // Skip geolocation prompt — we already know where to go. Still
      // load markets in a wide radius so the user can scroll around.
      loadMarkets(targetLat, targetLng)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setCenter(loc)
        setZoom(11)
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
    // The hook's empty-dep-array intent is preserved — hasTarget+coords
    // come from URL params which don't change without a full remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Synthetic pin for the target market (typically a draft we just
  // claimed, which isn't in the public visible_flea_markets feed and
  // would otherwise look like the map zoomed to nowhere). Skip when a
  // regular marker already sits within ~30m — published markets show
  // up in `markets` and we'd otherwise stack two pins on the same spot.
  if (hasTarget) {
    const dupe = markers.some((m) =>
      Math.abs(m.coord[0] - targetLat) < 0.0003 && Math.abs(m.coord[1] - targetLng) < 0.0005,
    )
    if (!dupe) {
      markers.push({
        id: '__target__',
        coord: [targetLat, targetLng],
        icon: 'market',
        popup: (
          <div className="min-w-[200px] p-1">
            <p className="font-display font-bold text-sm text-espresso">
              {targetName ?? 'Här'}
            </p>
            {targetSlug && (
              <Link
                href={`/loppis/${targetSlug}`}
                className="inline-block mt-2 text-xs text-rust font-semibold hover:text-rust-light transition-colors"
              >
                Tillbaka till sidan &rarr;
              </Link>
            )}
          </div>
        ),
      })
    }
  }

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
        <FlyToLocation lat={center[0]} lng={center[1]} zoom={zoom} />
      </FyndstigenMap>
    </div>
  )
}
