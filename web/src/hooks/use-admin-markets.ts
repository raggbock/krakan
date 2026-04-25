'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { AdminMarketEditInput } from '@fyndstigen/shared/contracts/admin-market-edit'

export function useAdminMarketActivity(marketId: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.marketActivity(marketId),
    queryFn: () => api.endpoints['admin.market.activity'].invoke({ marketId: marketId! }),
    enabled: !!marketId,
    staleTime: 10 * 1000,
  })
}

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

/**
 * Apply the same patch to N markets sequentially. Refetches once at the end
 * — the per-call invalidation from useAdminMarketEdit would otherwise re-fire
 * the overview query after every single edit.
 */
export function useAdminMarketsBulkEdit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { marketIds: string[]; patch: AdminMarketEditInput['patch'] }) => {
      for (const marketId of input.marketIds) {
        await api.endpoints['admin.market.edit'].invoke({ marketId, patch: input.patch })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.marketsOverview() })
    },
  })
}
