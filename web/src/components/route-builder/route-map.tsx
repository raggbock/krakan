'use client'

/**
 * Route-builder map wrapper.
 *
 * Uses the children escape hatch on <FyndstigenMap> for two reasons:
 * 1. MapClickHandler — requires useMapEvents() which must be a child of
 *    MapContainer. The click-to-set-custom-start behaviour is unique to
 *    this view and does not belong in the shared FyndstigenMap prop API.
 * 2. The start-point marker needs special popup text and is rendered via
 *    the children slot as a plain <Marker> rather than polluting MapMarker
 *    with a 'custom-start' semantic.
 */

import { useMapEvents, Marker, Popup } from 'react-leaflet'
import type { FleaMarketNearBy } from '@/lib/api'
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'
import { FyndstigenMap, startPointIcon, type MapMarker } from '../fyndstigen-map'

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

  return (
    <FyndstigenMap
      markers={markers}
      route={
        polylinePositions.length >= 2
          ? { coords: polylinePositions, style: 'dashed' }
          : undefined
      }
      fit="none"
      center={[59.27, 15.21]}
      zoom={11}
      onMarkerClick={(id) => {
        const market = markets.find((m) => m.id === id)
        if (market) onToggleMarket(market)
      }}
    >
      {/* Custom start-point click handler — needs useMapEvents inside MapContainer */}
      {!useGps && <MapClickHandler onMapClick={onCustomStartChange} />}

      {/* Custom start marker */}
      {!useGps && customStart && (
        <Marker
          position={[customStart.lat, customStart.lng]}
          icon={startPointIcon}
        >
          <Popup>
            <span className="text-sm font-medium">Startpunkt</span>
          </Popup>
        </Marker>
      )}
    </FyndstigenMap>
  )
}
