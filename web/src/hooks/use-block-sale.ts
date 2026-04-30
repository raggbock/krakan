'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endpoints } from '@/lib/edge'
import { queryKeys } from '@/lib/query-keys'
import type { ServerDataPort } from '@fyndstigen/shared'

type CreateInput = Parameters<typeof endpoints['block-sale.create']['invoke']>[0]

// The public meta API returns the port's getBlockSaleMeta result merged with id.
type BlockSaleMeta = NonNullable<Awaited<ReturnType<ServerDataPort['getBlockSaleMeta']>>> & { id: string }

export function useBlockSaleCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInput) => endpoints['block-sale.create'].invoke(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.blockSales.all() }),
  })
}

export function useBlockSale(slug: string) {
  return useQuery({
    queryKey: queryKeys.blockSales.bySlug(slug),
    queryFn: async (): Promise<BlockSaleMeta> => {
      const res = await fetch(`/api/block-sale-public-meta?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) throw new Error(String(res.status))
      return res.json() as Promise<BlockSaleMeta>
    },
  })
}
