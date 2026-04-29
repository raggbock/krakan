'use client'

import { useEffect, useState } from 'react'
import type { RouteStop } from '@fyndstigen/shared'
import { fetchDrivingRoute, type RoutingResult } from '@fyndstigen/shared'
import { FyndstigenMap, type MapMarker } from './fyndstigen-map'

type Props = {
  stops: RouteStop[]
  onRoutingResult?: (result: RoutingResult | null) => void
  onRoutingError?: (failed: boolean) => void
}

export default function RouteMap({ stops, onRoutingResult, onRoutingError }: Props) {
  const [roadGeometry, setRoadGeometry] = useState<[number, number][] | null>(null)

  const positions: [number, number][] = stops
    .filter((s) => s.fleaMarket)
    .map((s) => {
      const fm = s.fleaMarket as any
      return [fm.latitude ?? 59.27, fm.longitude ?? 15.21]
    })

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

  const markers: MapMarker[] = stops
    .filter((s) => s.fleaMarket)
    .map((s, i) => ({
      id: s.id,
      coord: positions[i]!,
      icon: 'stop',
      stopNumber: i + 1,
      popup: (
        <div className="min-w-[160px]">
          <p className="font-bold text-sm">{s.fleaMarket!.name}</p>
          <p className="text-xs text-gray-500 mt-1">{s.fleaMarket!.city}</p>
        </div>
      ),
    }))

  // Use road geometry when available, fall back to straight dashed lines
  // with the faded 'fallback' style so the user visually distinguishes them.
  const route = positions.length >= 2
    ? {
        coords: roadGeometry ?? positions,
        style: (roadGeometry ? 'solid' : 'fallback') as 'solid' | 'fallback',
      }
    : undefined

  const center: [number, number] =
    positions.length > 0
      ? [
          positions.reduce((s, p) => s + p[0], 0) / positions.length,
          positions.reduce((s, p) => s + p[1], 0) / positions.length,
        ]
      : [59.27, 15.21]

  return (
    <FyndstigenMap
      markers={markers}
      route={route}
      center={center}
      zoom={10}
    />
  )
}
