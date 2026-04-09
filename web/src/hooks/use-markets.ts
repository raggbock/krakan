'use client'

import { api, FleaMarket } from '@/lib/api'
import { useQuery } from './use-query'

export function useMarkets(params?: { page?: number; pageSize?: number }) {
  const { data, loading, error, refetch } = useQuery(
    () => api.fleaMarkets.list(params),
    { deps: [params?.page, params?.pageSize], errorMessage: 'Kunde inte ladda loppisar' },
  )
  return {
    markets: data?.items ?? [] as FleaMarket[],
    count: data?.count ?? 0,
    loading,
    error,
    refetch,
  }
}

export function useMarketsByOrganizer(organizerId: string | undefined) {
  const { data, loading, error } = useQuery(
    () => api.fleaMarkets.listByOrganizer(organizerId!),
    { deps: [organizerId], enabled: !!organizerId, errorMessage: 'Kunde inte ladda loppisar' },
  )
  return { markets: data ?? [] as FleaMarket[], loading, error }
}
