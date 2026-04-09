import type { SupabaseClient } from '@supabase/supabase-js'
import type { FleaMarketNearBy } from './types'
import { fetchDrivingRoute, type RoutingResult } from './routing'
import { optimizeRoute, type Stop } from './route-optimizer'

export type LatLng = { lat: number; lng: number }

export type GeoOptions = {
  /** Nominatim request timeout in ms (default 5000) */
  timeoutMs?: number
  /** User-Agent for Nominatim (default 'Fyndstigen/0.1') */
  userAgent?: string
  /** Fallback coordinates if geocoding fails (default: Stockholm) */
  fallback?: LatLng
}

export type GeoService = {
  /** Geocode a free-text address to coordinates. Returns fallback on failure. */
  geocode(address: string): Promise<LatLng>
  /** Find published flea markets within radiusKm of a point. */
  nearbyMarkets(center: LatLng, radiusKm: number): Promise<FleaMarketNearBy[]>
  /** Get driving route through ordered stops. */
  calculateRoute(stops: LatLng[]): Promise<RoutingResult | null>
  /** Reorder stops for shortest path (nearest-neighbor). */
  optimizeStops<T extends Stop>(stops: T[], startPoint?: LatLng): T[]
}

const STOCKHOLM: LatLng = { lat: 59.33, lng: 18.07 }

export function createGeo(supabase: SupabaseClient, options?: GeoOptions): GeoService {
  const timeoutMs = options?.timeoutMs ?? 5000
  const userAgent = options?.userAgent ?? 'Fyndstigen/0.1'
  const fallback = options?.fallback ?? STOCKHOLM

  return {
    async geocode(address: string): Promise<LatLng> {
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
        return fallback
      } catch {
        return fallback
      }
    },

    async nearbyMarkets(center: LatLng, radiusKm: number): Promise<FleaMarketNearBy[]> {
      const { data, error } = await supabase.rpc('nearby_flea_markets', {
        lat: center.lat,
        lng: center.lng,
        radius_km: radiusKm,
      })
      if (error) throw error
      return data as FleaMarketNearBy[]
    },

    async calculateRoute(stops: LatLng[]): Promise<RoutingResult | null> {
      return fetchDrivingRoute(stops)
    },

    optimizeStops<T extends Stop>(stops: T[], startPoint?: LatLng): T[] {
      return optimizeRoute(stops, startPoint) as T[]
    },
  }
}
