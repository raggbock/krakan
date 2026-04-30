import { z } from 'zod'
export const BlockSaleCreateInput = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyOpen: z.string().regex(/^\d{2}:\d{2}$/),
  dailyClose: z.string().regex(/^\d{2}:\d{2}$/),
  city: z.string().min(1).max(80),
  region: z.string().max(80).optional(),
  street: z.string().max(200).optional(),
  publish: z.boolean().default(false),
})
export const BlockSaleCreateOutput = z.object({
  ok: z.literal(true),
  slug: z.string(),
})
