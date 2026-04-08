type Coordinate = { lat: number; lng: number }

export type RouteLeg = {
  distance: number // meters
  duration: number // seconds
}

export type RoutingResult = {
  geometry: [number, number][] // [lat, lng] pairs for the polyline
  legs: RouteLeg[]
  totalDistance: number // meters
  totalDuration: number // seconds
}

/**
 * Fetch driving route from OSRM public API.
 * Takes an ordered array of stops and returns the road geometry + leg info.
 */
export async function fetchDrivingRoute(
  stops: Coordinate[],
): Promise<RoutingResult | null> {
  if (stops.length < 2) return null

  // OSRM expects lng,lat format separated by semicolons
  const coordinates = stops.map((s) => `${s.lng},${s.lat}`).join(';')

  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`

  try {
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) return null

    const route = data.routes[0]

    // GeoJSON coordinates are [lng, lat] — flip to [lat, lng] for Leaflet
    const geometry: [number, number][] =
      route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])

    const legs: RouteLeg[] = route.legs.map((leg: any) => ({
      distance: leg.distance,
      duration: leg.duration,
    }))

    return {
      geometry,
      legs,
      totalDistance: route.distance,
      totalDuration: route.duration,
    }
  } catch {
    return null
  }
}

/** Format meters to a human-readable string */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Format seconds to a human-readable string */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}
