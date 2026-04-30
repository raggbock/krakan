import { z } from 'zod'
export const BlockSaleStandEditInput = z.object({
  token: z.string().min(20),
  street: z.string().min(2).max(200).optional(),
  description: z.string().min(1).max(200).optional(),
})
export const BlockSaleStandEditOutput = z.object({
  ok: z.literal(true),
})
