'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { endpoints } from '@/lib/edge'
import { queryKeys } from '@/lib/query-keys'

export function useTakeoverInfo(token: string | null) {
  return useQuery({
    queryKey: queryKeys.takeover.info(token),
    queryFn: () => endpoints['takeover.info'].invoke({ token: token! }),
    enabled: !!token,
    retry: false,
  })
}

export function useTakeoverStart() {
  return useMutation({
    mutationFn: (args: { token: string; email: string }) =>
      endpoints['takeover.start'].invoke(args),
  })
}

export function useTakeoverVerify() {
  return useMutation({
    mutationFn: (args: { token: string; email: string; code: string }) =>
      endpoints['takeover.verify'].invoke(args),
  })
}

export function useTakeoverFeedback() {
  return useMutation({
    mutationFn: (args: { token: string; email: string; message: string }) =>
      endpoints['takeover.feedback'].invoke(args),
  })
}

export function useTakeoverRemove() {
  return useMutation({
    mutationFn: (args: { token: string; reason?: string }) =>
      endpoints['takeover.remove'].invoke(args),
  })
}

export function useTakeoverRequest() {
  return useMutation({
    mutationFn: (args: { marketId: string; email: string; note?: string }) =>
      endpoints['takeover.request'].invoke(args),
  })
}
