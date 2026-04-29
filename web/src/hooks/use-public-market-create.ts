'use client'

import { useMutation } from '@tanstack/react-query'
import { endpoints } from '@/lib/edge'

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
    }) => endpoints['public.market.create'].invoke(args),
  })
}
