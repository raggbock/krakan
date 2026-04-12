'use client'

import { useQuery } from '@tanstack/react-query'
import { api, FleaMarketDetails, MarketTable } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useMarketDetails(id: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.markets.details(id!),
    queryFn: () =>
      Promise.all([api.fleaMarkets.details(id!), api.marketTables.list(id!)]).then(
        ([market, tables]) => ({ market, tables }),
      ),
    enabled: !!id,
  })
  return {
    market: data?.market ?? (null as FleaMarketDetails | null),
    tables: data?.tables ?? ([] as MarketTable[]),
    loading: isLoading,
    error: error?.message ?? null,
  }
}
