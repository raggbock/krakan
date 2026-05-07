'use client'

import { useQuery } from '@tanstack/react-query'
import type { FleaMarketNearBy, GeoService } from '@fyndstigen/shared'

// Sweden center — national radius. The route builder filters client-side.
const SWEDEN_CENTER = { lat: 59.27, lng: 15.21 }
const RADIUS_KM = 2000

export function useMarketsQuery(geo: GeoService) {
  const { data } = useQuery<FleaMarketNearBy[]>({
    queryKey: ['route-builder', 'markets'],
    queryFn: () => geo.nearbyMarkets(SWEDEN_CENTER, RADIUS_KM),
    staleTime: Infinity,
  })
  return data
}
