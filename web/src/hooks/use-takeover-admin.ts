'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  AdminTakeoverPendingOutput,
  AdminTakeoverSendOutput,
} from '@fyndstigen/shared/contracts/admin-takeover-send'

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(error.message)
  return data as T
}

export function useTakeoverPending() {
  return useQuery({
    queryKey: ['admin', 'takeover', 'pending'],
    queryFn: () => invoke<AdminTakeoverPendingOutput>('admin-takeover-pending', {}),
  })
}

export function useTakeoverSend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (marketIds: string[]) =>
      invoke<AdminTakeoverSendOutput>('admin-takeover-send', { marketIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'takeover', 'pending'] })
      qc.invalidateQueries({ queryKey: ['admin', 'actions'] })
    },
  })
}
