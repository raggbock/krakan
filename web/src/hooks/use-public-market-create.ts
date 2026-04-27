'use client'

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function usePublicMarketCreate() {
  return useMutation({
    mutationFn: (args: {
      name: string
      city: string
      date: string
      openTime: string
      closeTime: string
      street?: string
      email: string
    }) => api.endpoints['public.market.create'].invoke(args),
  })
}
