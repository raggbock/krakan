import { z } from 'zod'
export const BlockSaleStandApplyInput = z.object({
  blockSaleId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  street: z.string().min(2).max(200),
  zipCode: z.string().max(10).optional(),
  city: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  website: z.string().max(0).optional(),
})
export const BlockSaleStandApplyOutput = z.object({
  ok: z.literal(true),
  standId: z.string().uuid(),
})
