'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useTakeoverPending() {
  return useQuery({
    queryKey: queryKeys.admin.takeoverPending(),
    queryFn: () => api.endpoints['admin.takeover.pending'].invoke({}),
  })
}

export function useTakeoverSend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (marketIds: string[]) =>
      api.endpoints['admin.takeover.send'].invoke({ marketIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.takeoverPending() })
      qc.invalidateQueries({ queryKey: queryKeys.admin.actions() })
    },
  })
}
