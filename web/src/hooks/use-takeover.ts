'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { invokeEdgeFn } from '@/lib/invoke'
import { queryKeys } from '@/lib/query-keys'

export type TakeoverInfo = { name: string; city: string | null; region: string | null }

export function useTakeoverInfo(token: string | null) {
  return useQuery({
    queryKey: queryKeys.takeover.info(token),
    queryFn: () => invokeEdgeFn<TakeoverInfo>('takeover-info', { token }),
    enabled: !!token,
    retry: false,
  })
}

export function useTakeoverStart() {
  return useMutation({
    mutationFn: (args: { token: string; email: string }) =>
      invokeEdgeFn<{ ok: true; expiresAt: string }>('takeover-start', args),
  })
}

export function useTakeoverVerify() {
  return useMutation({
    mutationFn: (args: { token: string; email: string; code: string }) =>
      invokeEdgeFn<{ ok: true; magicLinkSent: boolean }>('takeover-verify', args),
  })
}
