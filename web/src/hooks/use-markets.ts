'use client'

import { useQuery } from '@tanstack/react-query'
import type { FleaMarket } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useDeps } from '@/providers/deps-provider'

export function useMarkets(params?: { page?: number; pageSize?: number }) {
  const { markets } = useDeps()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.markets.list(params),
    queryFn: () => markets.list(params),
  })
  return {
    markets: data?.items ?? ([] as FleaMarket[]),
    count: data?.count ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  }
}

/**
 * Server-side nearest-first market list. Backed by the nearby_flea_markets
 * RPC which returns markets sorted by ascending distance from the given
 * point. The radius is generous (national-scale) — see map-view.tsx for the
 * rationale; clients page through the result client-side.
 */
export function useNearbyMarkets(userPos: { lat: number; lng: number } | null) {
  const { markets } = useDeps()
  const { data, isLoading, error } = useQuery({
    queryKey: ['markets', 'nearby', userPos?.lat ?? null, userPos?.lng ?? null],
    queryFn: () => markets.nearBy({ latitude: userPos!.lat, longitude: userPos!.lng, radiusKm: 2000 }),
    enabled: !!userPos,
  })
  return {
    markets: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useMarketsByOrganizer(organizerId: string | undefined) {
  const { markets } = useDeps()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.markets.byOrganizer(organizerId!),
    queryFn: () => markets.listByOrganizer(organizerId!),
    enabled: !!organizerId,
  })
  return {
    markets: data ?? ([] as FleaMarket[]),
    loading: isLoading,
    error: error?.message ?? null,
  }
}
