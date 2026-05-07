import type { Coord } from './types/domain'

export type Stop = Coord & {
  id: string
}

/**
 * Haversine distance in km between two points.
 */
function distanceKm(a: Coord, b: Coord): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Nearest-neighbor route optimization.
 * Returns a new array of stops in optimized order.
 * If startPoint is provided, the first stop will be the one nearest to it.
 * Otherwise, the original first stop is used as the starting point.
 */
export function optimizeRoute(stops: Stop[], startPoint?: Coord): Stop[] {
  if (stops.length <= 1) return [...stops]

  const remaining = [...stops]
  const result: Stop[] = []

  // Pick the first stop
  if (startPoint) {
    // Find the stop nearest to the start point
    let nearestIdx = 0
    let nearestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(startPoint, remaining[i])
      if (d < nearestDist) {
        nearestDist = d
        nearestIdx = i
      }
    }
    result.push(remaining.splice(nearestIdx, 1)[0])
  } else {
    result.push(remaining.splice(0, 1)[0])
  }

  // Greedily pick the nearest unvisited stop
  while (remaining.length > 0) {
    const current = result[result.length - 1]
    let nearestIdx = 0
    let nearestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(current, remaining[i])
      if (d < nearestDist) {
        nearestDist = d
        nearestIdx = i
      }
    }
    result.push(remaining.splice(nearestIdx, 1)[0])
  }

  return result
}
