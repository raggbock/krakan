'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type TakeoverInfo = { name: string; city: string | null; region: string | null }

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // Supabase SDK wraps non-2xx responses as FunctionsHttpError. The raw
    // body (which contains our error code like 'token_expired') is on
    // error.context — try to read it.
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context
    if (ctx?.json) {
      try {
        const body = (await ctx.json()) as { error?: string; code?: string }
        throw new Error(body.error ?? body.code ?? error.message)
      } catch {
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }
  return data as T
}

export function useTakeoverInfo(token: string | null) {
  return useQuery({
    queryKey: ['takeover', 'info', token],
    queryFn: () => invoke<TakeoverInfo>('takeover-info', { token }),
    enabled: !!token,
    retry: false,
  })
}

export function useTakeoverStart() {
  return useMutation({
    mutationFn: (args: { token: string; email: string }) =>
      invoke<{ ok: true; expiresAt: string }>('takeover-start', args),
  })
}

export function useTakeoverVerify() {
  return useMutation({
    mutationFn: (args: { token: string; email: string; code: string }) =>
      invoke<{ ok: true; magicLinkSent: boolean }>('takeover-verify', args),
  })
}
