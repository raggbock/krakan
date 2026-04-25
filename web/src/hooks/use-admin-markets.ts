'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { AdminMarketEditInput } from '@fyndstigen/shared/contracts/admin-market-edit'

export function useAdminMarketsOverview() {
  return useQuery({
    queryKey: queryKeys.admin.marketsOverview(),
    queryFn: () => api.endpoints['admin.markets.overview'].invoke({}),
    staleTime: 30 * 1000,
  })
}

export function useAdminMarketEdit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminMarketEditInput) =>
      api.endpoints['admin.market.edit'].invoke(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.marketsOverview() })
    },
  })
}
