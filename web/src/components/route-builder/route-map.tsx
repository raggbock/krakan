'use client'

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { FleaMarketNearBy } from '@/lib/api'
import { inactiveMarkerIcon, numberedMarkerIcon, startPointIcon } from '@/lib/map-markers'
import type { OpeningHourRule, OpeningHourException } from '@fyndstigen/shared'

type MarketWithHours = FleaMarketNearBy & {
  opening_hour_rules?: OpeningHourRule[]
  opening_hour_exceptions?: OpeningHourException[]
}

type Props = {
  markets: MarketWithHours[]
  stops: Array<{ market: MarketWithHours; index: number }>
  onToggleMarket: (market: MarketWithHours) => void
  isInRoute: (marketId: string) => boolean
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
  isInRoute,
  useGps,
  customStart,
  onCustomStartChange,
}: Props) {
  const polylinePositions: [number, number][] = stops.map((s) => [
    s.market.latitude,
    s.market.longitude,
  ])

  return (
    <MapContainer
      center={[59.27, 15.21]}
      zoom={11}
      className="h-full w-full"
      style={{ minHeight: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Custom start point click handler */}
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

      {/* Market markers */}
      {markets.map((market) => {
        const stopIndex = stops.findIndex((s) => s.market.id === market.id)
        const inRoute = stopIndex >= 0

        return (
          <Marker
            key={market.id}
            position={[market.latitude, market.longitude]}
            icon={inRoute ? numberedMarkerIcon(stopIndex + 1) : inactiveMarkerIcon}
            eventHandlers={{
              click: () => onToggleMarket(market),
            }}
          >
            <Popup>
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
            </Popup>
          </Marker>
        )
      })}

      {/* Route polyline */}
      {polylinePositions.length >= 2 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#C45B35',
            weight: 3,
            opacity: 0.7,
            dashArray: '8, 8',
          }}
        />
      )}
    </MapContainer>
  )
}
