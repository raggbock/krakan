'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteStop } from '@/lib/api'
import { formatDistance, formatDuration, fetchDrivingRoute, type RoutingResult } from '@fyndstigen/shared'
import { numberedMarkerIcon } from '@/lib/map-markers'

type Props = {
  stops: RouteStop[]
  onRoutingResult?: (result: RoutingResult | null) => void
  onRoutingError?: (failed: boolean) => void
}

export default function RouteMap({ stops, onRoutingResult, onRoutingError }: Props) {
  const [roadGeometry, setRoadGeometry] = useState<[number, number][] | null>(
    null,
  )

  const positions: [number, number][] = stops
    .filter((s) => s.fleaMarket)
    .map((s) => {
      const fm = s.fleaMarket as any
      return [fm.latitude ?? 59.27, fm.longitude ?? 15.21]
    })

  const center: [number, number] =
    positions.length > 0
      ? [
          positions.reduce((s, p) => s + p[0], 0) / positions.length,
          positions.reduce((s, p) => s + p[1], 0) / positions.length,
        ]
      : [59.27, 15.21]

  // Fetch real driving route
  useEffect(() => {
    if (positions.length < 2) {
      setRoadGeometry(null)
      onRoutingResult?.(null)
      return
    }

    const coords = positions.map(([lat, lng]) => ({ lat, lng }))
    onRoutingError?.(false)
    fetchDrivingRoute(coords).then((result) => {
      if (result) {
        setRoadGeometry(result.geometry)
      } else {
        setRoadGeometry(null)
        onRoutingError?.(true)
      }
      onRoutingResult?.(result)
    })
  }, [stops.map((s) => s.fleaMarket?.id).join(',')])

  return (
    <MapContainer
      center={center}
      zoom={10}
      className="h-full w-full"
      style={{ minHeight: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {stops.map((stop, i) => {
        if (!stop.fleaMarket) return null
        const pos = positions[i]
        if (!pos) return null

        return (
          <Marker
            key={stop.id}
            position={pos}
            icon={numberedMarkerIcon(i + 1)}
          >
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-bold text-sm">{stop.fleaMarket.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stop.fleaMarket.city}
                </p>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* Road route (solid) or fallback to straight dashed lines */}
      {roadGeometry && roadGeometry.length >= 2 ? (
        <Polyline
          positions={roadGeometry}
          pathOptions={{
            color: '#C45B35',
            weight: 4,
            opacity: 0.8,
          }}
        />
      ) : (
        positions.length >= 2 && (
          <Polyline
            positions={positions}
            pathOptions={{
              color: '#C45B35',
              weight: 3,
              opacity: 0.5,
              dashArray: '8, 8',
            }}
          />
        )
      )}
    </MapContainer>
  )
}
