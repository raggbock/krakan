import { z } from 'zod'
export const BlockSaleStandConfirmInput = z.object({
  token: z.string().min(20),
})
export const BlockSaleStandConfirmOutput = z.object({
  ok: z.literal(true),
  standId: z.string().uuid(),
})
