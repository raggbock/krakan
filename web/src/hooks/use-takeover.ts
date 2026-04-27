'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useTakeoverInfo(token: string | null) {
  return useQuery({
    queryKey: queryKeys.takeover.info(token),
    queryFn: () => api.endpoints['takeover.info'].invoke({ token: token! }),
    enabled: !!token,
    retry: false,
  })
}

export function useTakeoverStart() {
  return useMutation({
    mutationFn: (args: { token: string; email: string }) =>
      api.endpoints['takeover.start'].invoke(args),
  })
}

export function useTakeoverVerify() {
  return useMutation({
    mutationFn: (args: { token: string; email: string; code: string }) =>
      api.endpoints['takeover.verify'].invoke(args),
  })
}

export function useTakeoverFeedback() {
  return useMutation({
    mutationFn: (args: { token: string; email: string; message: string }) =>
      api.endpoints['takeover.feedback'].invoke(args),
  })
}

export function useTakeoverRemove() {
  return useMutation({
    mutationFn: (args: { token: string; reason?: string }) =>
      api.endpoints['takeover.remove'].invoke(args),
  })
}
