'use client'

import { api, FleaMarketDetails, MarketTable } from '@/lib/api'
import { useQuery } from './use-query'

export function useMarketDetails(id: string | undefined) {
  const { data, loading, error } = useQuery(
    () => Promise.all([api.fleaMarkets.details(id!), api.marketTables.list(id!)]).then(
      ([market, tables]) => ({ market, tables }),
    ),
    { deps: [id], enabled: !!id, errorMessage: 'Kunde inte ladda loppisen' },
  )
  return {
    market: data?.market ?? null as FleaMarketDetails | null,
    tables: data?.tables ?? [] as MarketTable[],
    loading,
    error,
  }
}
