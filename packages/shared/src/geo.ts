import type { SupabaseClient } from '@supabase/supabase-js'
import type { FleaMarketNearBy } from './types'
import type { Coord } from './types/domain'
import { optimizeRoute, type Stop } from './route-optimizer'

/**
 * @deprecated Use `Coord` from '@fyndstigen/shared' instead.
 * Kept for one release to avoid breaking external imports.
 */
export type LatLng = Coord

export class GeocodeError extends Error {
  constructor(address: string, cause?: unknown) {
    super(`Kunde inte hitta koordinater för adressen: "${address}"`)
    this.name = 'GeocodeError'
    this.cause = cause
  }
}

export type GeoOptions = {
  /** Nominatim request timeout in ms (default 5000) */
  timeoutMs?: number
  /** User-Agent for Nominatim (default 'Fyndstigen/0.1') */
  userAgent?: string
}

export type GeoService = {
  /** Geocode a free-text address to coordinates. Throws GeocodeError on failure. */
  geocode(address: string): Promise<Coord>
  /** Find published flea markets within radiusKm of a point. */
  nearbyMarkets(center: Coord, radiusKm: number): Promise<FleaMarketNearBy[]>
  /** Reorder stops for shortest path (nearest-neighbor). */
  optimizeStops<T extends Stop>(stops: T[], startPoint?: Coord): T[]
}

export function createGeo(supabase: SupabaseClient, options?: GeoOptions): GeoService {
  const timeoutMs = options?.timeoutMs ?? 5000
  const userAgent = options?.userAgent ?? 'Fyndstigen/0.1'

  return {
    async geocode(address: string): Promise<Coord> {
      try {
        const q = encodeURIComponent(address)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
          { headers: { 'User-Agent': userAgent }, signal: controller.signal },
        )
        clearTimeout(timer)
        const results = await res.json()
        if (results.length > 0) {
          return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
        }
        throw new GeocodeError(address)
      } catch (err) {
        if (err instanceof GeocodeError) throw err
        throw new GeocodeError(address, err)
      }
    },

    async nearbyMarkets(center: Coord, radiusKm: number): Promise<FleaMarketNearBy[]> {
      const { data, error } = await supabase.rpc('nearby_flea_markets', {
        lat: center.lat,
        lng: center.lng,
        radius_km: radiusKm,
      })
      if (error) throw error
      return data as FleaMarketNearBy[]
    },

    optimizeStops<T extends Stop>(stops: T[], startPoint?: Coord): T[] {
      return optimizeRoute(stops, startPoint) as T[]
    },
  }
}
