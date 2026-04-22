'use client'

import { useQuery } from '@tanstack/react-query'
import type { FleaMarketDetails, MarketTable } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useDeps } from '@/providers/deps-provider'

export function useMarketDetails(id: string | undefined) {
  const { markets, marketTables } = useDeps()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.markets.details(id!),
    queryFn: () =>
      Promise.all([markets.details(id!), marketTables.list(id!)]).then(
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
