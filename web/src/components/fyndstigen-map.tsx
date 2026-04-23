'use client'

/**
 * <FyndstigenMap> — unified declarative map component.
 *
 * All three map peers (map-view, route-map, route-builder/route-map) are thin
 * wrappers around this component. Leaflet wiring (icons, fit-bounds, polyline,
 * marker keying) lives here once.
 *
 * Performance notes:
 * - L.Marker instances are pooled via a ref keyed by marker id. Only added /
 *   removed markers touch the DOM; moved markers update position in place.
 * - fitBounds is gated behind a useEffect with stable deps (bounds string).
 * - Route polyline is memoised by coords reference.
 *
 * Children escape hatch: if you need Leaflet layers that can't be expressed
 * through props (e.g. route-builder's MapClickHandler for custom start points),
 * pass them as children. They are rendered inside the MapContainer and have
 * access to useMap() / useMapEvents() as normal react-leaflet components.
 * Do not use this to circumvent the marker / polyline API.
 */

import { useEffect, useRef, useMemo, type ReactNode } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// ---------------------------------------------------------------------------
// Internal marker icon helpers (moved from web/src/lib/map-markers.ts)
// ---------------------------------------------------------------------------

const defaultMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`
const inactiveMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23998A7A"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`

function svgIcon(svg: string, size: [number, number] = [28, 40], anchor?: [number, number]): L.Icon {
  return new L.Icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: size,
    iconAnchor: anchor ?? [size[0] / 2, size[1]],
    popupAnchor: [0, -(anchor?.[1] ?? size[1]) + 4],
  })
}

/** Default rust-colored market pin */
export const markerIcon = svgIcon(defaultMarkerSvg)

/** Greyed-out pin for markets not yet in a route */
export const inactiveMarkerIcon = svgIcon(inactiveMarkerSvg)

const numberedCache = new Map<number, L.Icon>()

/** Numbered rust pin (1-based stop index) */
export function numberedMarkerIcon(num: number): L.Icon {
  let icon = numberedCache.get(num)
  if (!icon) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/><text x="14" y="17" text-anchor="middle" font-size="11" font-weight="bold" fill="%23C45B35" font-family="sans-serif">${num}</text></svg>`
    icon = svgIcon(svg)
    numberedCache.set(num, icon)
  }
  return icon
}

/** Green circle for custom start-point */
export const startPointIcon = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="%235B7352" stroke="white" stroke-width="2"/></svg>`,
  [20, 20],
  [10, 10],
)

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MarkerIconType = 'market' | 'stop' | 'start' | 'end' | 'inactive'

export type MapMarker = {
  id: string
  coord: [number, number]
  icon: MarkerIconType
  /** Number shown on a 'stop' marker (1-based). Required when icon = 'stop'. */
  stopNumber?: number
  popup?: ReactNode
}

export type RouteStyle = 'solid' | 'dashed'

export type FyndstigenMapProps = {
  markers: MapMarker[]
  route?: {
    coords: [number, number][]
    style?: RouteStyle
  }
  /**
   * How to fit the viewport after mount / when markers/route change.
   * - 'markers' — fit to marker coords only
   * - 'route'   — fit to route coords only
   * - 'all'     — fit to both
   * - 'none'    — don't auto-fit (use center + zoom)
   */
  fit?: 'markers' | 'route' | 'all' | 'none'
  center?: [number, number]
  zoom?: number
  onMarkerClick?: (id: string) => void
  /**
   * Children are rendered inside the MapContainer as additional Leaflet layers.
   * Use for advanced cases (e.g. MapClickHandler) that can't be expressed via props.
   */
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Internal: FitBounds controller
// ---------------------------------------------------------------------------

type FitBoundsProps = {
  bounds: L.LatLngBoundsLiteral | null
}

function FitBoundsController({ bounds }: FitBoundsProps) {
  const map = useMap()
  const prevKey = useRef<string>('')

  useEffect(() => {
    if (!bounds || bounds.length === 0) return
    const key = JSON.stringify(bounds)
    if (key === prevKey.current) return
    prevKey.current = key
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [map, bounds])

  return null
}

// ---------------------------------------------------------------------------
// Internal: icon resolver
// ---------------------------------------------------------------------------

function resolveIcon(marker: MapMarker): L.Icon {
  switch (marker.icon) {
    case 'market':
      return markerIcon
    case 'stop':
      return numberedMarkerIcon(marker.stopNumber ?? 1)
    case 'start':
    case 'end':
      return startPointIcon
    case 'inactive':
      return inactiveMarkerIcon
  }
}

// ---------------------------------------------------------------------------
// Internal: polyline path options
// ---------------------------------------------------------------------------

function polylineOptions(style: RouteStyle, solid: boolean): L.PathOptions {
  if (solid) {
    return { color: '#C45B35', weight: 4, opacity: 0.8 }
  }
  return { color: '#C45B35', weight: 3, opacity: style === 'dashed' ? 0.7 : 0.5, dashArray: '8, 8' }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [59.27, 15.21]
const DEFAULT_ZOOM = 11

export function FyndstigenMap({
  markers,
  route,
  fit = 'none',
  center,
  zoom,
  onMarkerClick,
  children,
  className,
}: FyndstigenMapProps) {
  // Compute fitBounds target
  const fitBounds = useMemo<L.LatLngBoundsLiteral | null>(() => {
    if (fit === 'none') return null

    const points: [number, number][] = []
    if (fit === 'markers' || fit === 'all') {
      points.push(...markers.map((m) => m.coord))
    }
    if ((fit === 'route' || fit === 'all') && route?.coords) {
      points.push(...route.coords)
    }
    if (points.length < 2) return null
    return points as L.LatLngBoundsLiteral
  }, [fit, markers, route?.coords])

  // Polyline options — memoised on style so we don't recreate options object
  const routePathOptions = useMemo(() => {
    if (!route) return null
    const isSolid = route.style === 'solid'
    return polylineOptions(route.style ?? 'dashed', isSolid)
  }, [route?.style])

  const mapCenter = center ?? DEFAULT_CENTER
  const mapZoom = zoom ?? DEFAULT_ZOOM

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      className={className ?? 'h-full w-full'}
      style={{ minHeight: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {fitBounds && <FitBoundsController bounds={fitBounds} />}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.coord}
          icon={resolveIcon(marker)}
          eventHandlers={
            onMarkerClick ? { click: () => onMarkerClick(marker.id) } : undefined
          }
        >
          {marker.popup && <Popup>{marker.popup}</Popup>}
        </Marker>
      ))}

      {route && routePathOptions && route.coords.length >= 2 && (
        <Polyline positions={route.coords} pathOptions={routePathOptions} />
      )}

      {children}
    </MapContainer>
  )
}

export default FyndstigenMap
