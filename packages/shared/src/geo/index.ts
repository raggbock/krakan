/**
 * GeoService — geocoding, nearby-market lookup, and stop optimization.
 *
 * `createGeo(supabaseClient, options?)` returns a `GeoService` instance that:
 *   - `geocode(address)` — calls Nominatim (openstreetmap.org). Rate-limit policy:
 *       one request at a time, 5-second timeout (configurable). The User-Agent
 *       header is required by the Nominatim usage policy; it defaults to
 *       'Fyndstigen/0.1'. Do not parallelize geocode calls from the same IP.
 *       Throws `GeocodeError` on failure.
 *   - `nearbyMarkets(center, radiusKm)` — calls the `nearby_flea_markets` Supabase
 *       RPC; returns published markets within the given radius.
 *   - `optimizeStops(stops, startPoint?)` — thin wrapper over `domain/route-optimizer`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Coord, FleaMarketNearByView } from '../types/domain'
import { optimizeRoute, type Stop } from '../domain/route-optimizer'

type NearbyFleaMarketRpcRow = {
  id: string
  name: string
  description: string
  city: string
  is_permanent: boolean
  latitude: number
  longitude: number
  distance_km: number
  published_at: string | null
  slug?: string | null
}

function mapNearbyFleaMarket(r: NearbyFleaMarketRpcRow): FleaMarketNearByView {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    city: r.city,
    isPermanent: r.is_permanent,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distance_km,
    publishedAt: r.published_at,
    slug: r.slug ?? null,
  }
}

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
  nearbyMarkets(center: Coord, radiusKm: number): Promise<FleaMarketNearByView[]>
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

    async nearbyMarkets(center: Coord, radiusKm: number): Promise<FleaMarketNearByView[]> {
      const { data, error } = await supabase.rpc('nearby_flea_markets', {
        lat: center.lat,
        lng: center.lng,
        radius_km: radiusKm,
      })
      if (error) throw error
      return (data as NearbyFleaMarketRpcRow[] ?? []).map(mapNearbyFleaMarket)
    },

    optimizeStops<T extends Stop>(stops: T[], startPoint?: Coord): T[] {
      return optimizeRoute(stops, startPoint) as T[]
    },
  }
}
