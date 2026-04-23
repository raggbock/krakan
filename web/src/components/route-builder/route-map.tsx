'use client'

/**
 * Route-builder map wrapper.
 *
 * Uses the children escape hatch on <FyndstigenMap> only for MapClickHandler —
 * `useMapEvents()` must be a child of MapContainer and the click-to-set-
 * custom-start behaviour is unique to this view. The start-point marker is
 * just a `MapMarker` with `icon: 'start'` — no Leaflet primitive leaks.
 */

import { useMapEvents } from 'react-leaflet'
import type { FleaMarketNearBy } from '@/lib/api'
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'
import { FyndstigenMap, type MapMarker } from '../fyndstigen-map'

type MarketWithHours = FleaMarketNearBy & {
  opening_hour_rules?: OpeningHourRule[]
  opening_hour_exceptions?: OpeningHourException[]
}

type Props = {
  markets: MarketWithHours[]
  stops: Array<{ market: MarketWithHours; index: number }>
  onToggleMarket: (market: MarketWithHours) => void
  useGps: boolean
  customStart: { lat: number; lng: number } | null
  onCustomStartChange: (pos: { lat: number; lng: number }) => void
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (pos: { lat: number; lng: number }) => void
}) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export function RouteMap({
  markets,
  stops,
  onToggleMarket,
  useGps,
  customStart,
  onCustomStartChange,
}: Props) {
  const markers: MapMarker[] = markets.map((market) => {
    const stopIndex = stops.findIndex((s) => s.market.id === market.id)
    const inRoute = stopIndex >= 0

    return {
      id: market.id,
      coord: [market.latitude, market.longitude],
      icon: inRoute ? 'stop' : 'inactive',
      stopNumber: inRoute ? stopIndex + 1 : undefined,
      popup: (
        <div className="min-w-[180px] p-1">
          <p className="font-display font-bold text-sm">{market.name}</p>
          <p className="text-xs text-espresso/65 mt-1">{market.city}</p>
          <button
            onClick={() => onToggleMarket(market)}
            className={`mt-2 text-xs font-semibold ${inRoute ? 'text-error' : 'text-rust'}`}
          >
            {inRoute ? 'Ta bort från rundan' : 'Lägg till i rundan'}
          </button>
        </div>
      ),
    }
  })

  const polylinePositions: [number, number][] = stops.map((s) => [
    s.market.latitude,
    s.market.longitude,
  ])

  const allMarkers: MapMarker[] =
    !useGps && customStart
      ? [
          ...markers,
          {
            id: '__custom-start',
            coord: [customStart.lat, customStart.lng],
            icon: 'start',
            popup: <span className="text-sm font-medium">Startpunkt</span>,
          },
        ]
      : markers

  return (
    <FyndstigenMap
      markers={allMarkers}
      route={
        polylinePositions.length >= 2
          ? { coords: polylinePositions, style: 'dashed' }
          : undefined
      }
      center={[59.27, 15.21]}
      zoom={11}
      onMarkerClick={(id) => {
        if (id === '__custom-start') return
        const market = markets.find((m) => m.id === id)
        if (market) onToggleMarket(market)
      }}
    >
      {/* Custom start-point click handler — needs useMapEvents inside MapContainer */}
      {!useGps && <MapClickHandler onMapClick={onCustomStartChange} />}
    </FyndstigenMap>
  )
}
