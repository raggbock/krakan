'use client'

/**
 * <FyndstigenMap> — unified declarative map component.
 *
 * All three map peers (map-view, route-map, route-builder/route-map) are thin
 * wrappers around this component. Leaflet wiring (icons, polyline, marker
 * keying) lives here once.
 *
 * Performance notes:
 * - Markers are keyed by id, so react-leaflet performs setLatLng updates
 *   in place instead of remounting when positions change.
 * - Route polyline pathOptions are memoised by style.
 *
 * Children escape hatch: if you need Leaflet layers that can't be expressed
 * through props (e.g. route-builder's MapClickHandler for map-click events),
 * pass them as children. They are rendered inside the MapContainer and have
 * access to useMap() / useMapEvents() as normal react-leaflet components.
 * Do not use this to circumvent the marker / polyline API.
 */

import { useMemo, type ReactNode } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'

// ---------------------------------------------------------------------------
// Internal marker icon helpers (moved from web/src/lib/map-markers.ts)
// ---------------------------------------------------------------------------

const defaultMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`
const inactiveMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23998A7A"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`
/** Lilac pin for kvartersloppis (neighborhood flea market events) */
const blockSaleMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%237c3aed"/><path d="M9 16v-5l5-4 5 4v5h-3v-3h-4v3z" fill="%23F2EBE0"/></svg>`

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

/** Lilac house pin for kvartersloppis events */
export const blockSaleMarkerIcon = svgIcon(blockSaleMarkerSvg)

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

export type MarkerIconType = 'market' | 'stop' | 'start' | 'end' | 'inactive' | 'block_sale'

export type MapMarker = {
  id: string
  coord: [number, number]
  icon: MarkerIconType
  /** Number shown on a 'stop' marker (1-based). Required when icon = 'stop'. */
  stopNumber?: number
  popup?: ReactNode
}

/**
 * Route line styles. Matches the three caller sites on main:
 * - 'solid'     — weight 4, opacity 0.8 (route-map: OSRM result)
 * - 'dashed'    — weight 3, opacity 0.7, 8,8 dash (route-builder: planning)
 * - 'fallback'  — weight 3, opacity 0.5, 8,8 dash (route-map: straight-line fallback)
 */
export type RouteStyle = 'solid' | 'dashed' | 'fallback'

export type FyndstigenMapProps = {
  markers: MapMarker[]
  route?: {
    coords: [number, number][]
    style?: RouteStyle
  }
  center?: [number, number]
  zoom?: number
  onMarkerClick?: (id: string) => void
  /**
   * Group nearby markers into clusters that expand on zoom-in.
   * Default false — route-builder and per-route maps want individual
   * markers visible at all zoom levels. Public discovery maps with N>50
   * markers should pass cluster=true to keep the view readable.
   */
  cluster?: boolean
  /**
   * Children are rendered inside the MapContainer as additional Leaflet layers.
   * Use for advanced cases (e.g. MapClickHandler) that can't be expressed via props.
   */
  children?: ReactNode
  className?: string
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
    case 'block_sale':
      return blockSaleMarkerIcon
  }
}

// ---------------------------------------------------------------------------
// Internal: polyline path options
// ---------------------------------------------------------------------------

function polylineOptions(style: RouteStyle): L.PathOptions {
  switch (style) {
    case 'solid':
      return { color: '#C45B35', weight: 4, opacity: 0.8 }
    case 'dashed':
      return { color: '#C45B35', weight: 3, opacity: 0.7, dashArray: '8, 8' }
    case 'fallback':
      return { color: '#C45B35', weight: 3, opacity: 0.5, dashArray: '8, 8' }
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [59.27, 15.21]
const DEFAULT_ZOOM = 11

export function FyndstigenMap({
  markers,
  route,
  center,
  zoom,
  onMarkerClick,
  cluster,
  children,
  className,
}: FyndstigenMapProps) {
  // Polyline options — memoised on style so we don't recreate options object
  const routePathOptions = useMemo(
    () => (route ? polylineOptions(route.style ?? 'dashed') : null),
    [route?.style],
  )

  const mapCenter = center ?? DEFAULT_CENTER
  const mapZoom = zoom ?? DEFAULT_ZOOM

  const markerNodes = markers.map((marker) => (
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
  ))

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

      {cluster ? (
        // chunkedLoading prevents UI freeze when adding hundreds of markers
        // at once; the default 80px maxClusterRadius keeps clusters tight
        // enough that a click reveals a manageable number of pins.
        <MarkerClusterGroup chunkedLoading maxClusterRadius={60}>
          {markerNodes}
        </MarkerClusterGroup>
      ) : (
        markerNodes
      )}

      {route && routePathOptions && route.coords.length >= 2 && (
        <Polyline positions={route.coords} pathOptions={routePathOptions} />
      )}

      {children}
    </MapContainer>
  )
}

export default FyndstigenMap
