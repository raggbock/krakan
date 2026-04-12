'use client'

import { useQuery } from '@tanstack/react-query'
import { api, FleaMarket } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useMarkets(params?: { page?: number; pageSize?: number }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.markets.list(params),
    queryFn: () => api.fleaMarkets.list(params),
  })
  return {
    markets: data?.items ?? ([] as FleaMarket[]),
    count: data?.count ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  }
}

export function useMarketsByOrganizer(organizerId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.markets.byOrganizer(organizerId!),
    queryFn: () => api.fleaMarkets.listByOrganizer(organizerId!),
    enabled: !!organizerId,
  })
  return {
    markets: data ?? ([] as FleaMarket[]),
    loading: isLoading,
    error: error?.message ?? null,
  }
}
