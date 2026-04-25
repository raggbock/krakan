'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useAdminMarketsOverview() {
  return useQuery({
    queryKey: queryKeys.admin.marketsOverview(),
    queryFn: () => api.endpoints['admin.markets.overview'].invoke({}),
    staleTime: 30 * 1000,
  })
}
