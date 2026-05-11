import type { Coord, FleaMarketNearByView } from '../../types/domain'
import type { GeoService } from '../../geo'
import type { FleaMarketRepository } from '../../ports/flea-markets'
import { optimizeRoute, type Stop } from '../../domain/route-optimizer'

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
 * In-memory GeoService — used by unit + E2E tests so the route-builder can
 * resolve `nearbyMarkets` from the same seeded store the rest of the app uses,
 * without hitting Nominatim or the Supabase RPC.
 *
 * `geocode` returns a fixed dummy coord (Göteborg city centre) — real
 * geocoding needs network. Tests that depend on a specific resolved
 * coordinate should pass their own mock or stub at the call site.
 */
export function createInMemoryGeo(deps: { fleaMarkets: FleaMarketRepository }): GeoService {
  return {
    async geocode(_address: string): Promise<Coord> {
      return { lat: 57.7089, lng: 11.9746 }
    },

    async nearbyMarkets(center: Coord, radiusKm: number): Promise<FleaMarketNearByView[]> {
      const { items } = await deps.fleaMarkets.list({ pageSize: 1000 })
      const withDistance = items
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => {
          const d = distanceKm(center, { lat: m.latitude, lng: m.longitude })
          const view: FleaMarketNearByView = {
            id: m.id,
            name: m.name,
            description: m.description,
            city: m.city,
            isPermanent: m.isPermanent,
            latitude: m.latitude,
            longitude: m.longitude,
            distanceKm: d,
            publishedAt: m.publishedAt,
            slug: m.slug ?? null,
          }
          return view
        })
        .filter((m) => m.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
      return withDistance
    },

    optimizeStops<T extends Stop>(stops: T[], startPoint?: Coord): T[] {
      return optimizeRoute(stops, startPoint) as T[]
    },
  }
}
