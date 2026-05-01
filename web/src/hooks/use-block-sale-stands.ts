'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePostHog } from 'posthog-js/react'
import { endpoints } from '@/lib/edge'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase/browser'

export type StandRow = {
  id: string
  applicant_name: string
  applicant_email: string
  street: string
  city: string
  description: string
  status: 'pending' | 'confirmed' | 'approved' | 'rejected'
  created_at: string
  latitude: number | null
  longitude: number | null
}

export function useBlockSaleQueue(slug: string, blockSaleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.blockSales.queue(slug),
    enabled: !!blockSaleId,
    queryFn: async (): Promise<StandRow[]> => {
      const { data, error } = await supabase
        .from('block_sale_stands')
        .select('id, applicant_name, applicant_email, street, city, description, status, created_at, latitude, longitude')
        .eq('block_sale_id', blockSaleId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as StandRow[]
    },
  })
}

type DecideInput = Parameters<typeof endpoints['block-sale.decide']['invoke']>[0]
type DecideResult = Awaited<ReturnType<typeof endpoints['block-sale.decide']['invoke']>>

export function useBlockSaleDecide(slug: string) {
  const qc = useQueryClient()
  const posthog = usePostHog()
  return useMutation({
    mutationFn: (input: DecideInput) => endpoints['block-sale.decide'].invoke(input),
    onSuccess: (result: DecideResult, input: DecideInput) => {
      posthog?.capture('block_sale_decision', {
        blockSaleId: input.blockSaleId,
        decision: input.decision,
        count: input.standIds.length,
        decided: result.decided,
      })
      void qc.invalidateQueries({ queryKey: queryKeys.blockSales.queue(slug) })
    },
  })
}
