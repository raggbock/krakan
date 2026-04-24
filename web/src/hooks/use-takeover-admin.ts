'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invokeEdgeFn } from '@/lib/invoke'
import { queryKeys } from '@/lib/query-keys'
import type {
  AdminTakeoverPendingOutput,
  AdminTakeoverSendOutput,
} from '@fyndstigen/shared/contracts/admin-takeover-send'

export function useTakeoverPending() {
  return useQuery({
    queryKey: queryKeys.admin.takeoverPending(),
    queryFn: () => invokeEdgeFn<AdminTakeoverPendingOutput>('admin-takeover-pending', {}),
  })
}

export function useTakeoverSend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (marketIds: string[]) =>
      invokeEdgeFn<AdminTakeoverSendOutput>('admin-takeover-send', { marketIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.takeoverPending() })
      qc.invalidateQueries({ queryKey: queryKeys.admin.actions() })
    },
  })
}
