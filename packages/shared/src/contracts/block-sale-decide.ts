import { z } from 'zod'
export const BlockSaleDecideInput = z.object({
  blockSaleId: z.string().uuid(),
  standIds: z.array(z.string().uuid()).min(1).max(100),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})
export const BlockSaleDecideOutput = z.object({
  ok: z.literal(true),
  decided: z.number(),
})
