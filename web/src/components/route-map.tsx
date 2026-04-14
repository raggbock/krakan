'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteStop } from '@/lib/api'
import { formatDistance, formatDuration, fetchDrivingRoute, type RoutingResult } from '@fyndstigen/shared'

const markerSvg = (num: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/><text x="14" y="17" text-anchor="middle" font-size="11" font-weight="bold" fill="%23C45B35" font-family="sans-serif">${num}</text></svg>`

type Props = {
  stops: RouteStop[]
  onRoutingResult?: (result: RoutingResult | null) => void
  onRoutingError?: (failed: boolean) => void
}

function MapCleanup() {
  const map = useMap()
  useEffect(() => {
    return () => {
      map.remove()
    }
  }, [map])
  return null
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
      <MapCleanup />
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
            icon={
              new L.Icon({
                iconUrl: `data:image/svg+xml,${encodeURIComponent(markerSvg(i + 1))}`,
                iconSize: [28, 40],
                iconAnchor: [14, 40],
                popupAnchor: [0, -36],
              })
            }
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
