import { z } from 'zod'

export const AdminTakeoverPendingInput = z.object({})
export const AdminTakeoverPendingMarket = z.object({
  marketId: z.string().uuid(),
  name: z.string(),
  city: z.string().nullable(),
  contactEmail: z.string().nullable(),
  priority: z.number().int(),
  sentAt: z.string().nullable(),
})
export const AdminTakeoverPendingOutput = z.object({
  markets: z.array(AdminTakeoverPendingMarket),
})

export const AdminTakeoverSendInput = z.object({
  marketIds: z.array(z.string().uuid()).min(1),
})
export const AdminTakeoverSendResult = z.object({
  marketId: z.string().uuid(),
  status: z.enum(['sent', 'skipped', 'error']),
  email: z.string().nullable(),
  reason: z.string().nullable(),
})
export const AdminTakeoverSendOutput = z.object({
  results: z.array(AdminTakeoverSendResult),
  summary: z.object({
    sent: z.number().int(),
    skipped: z.number().int(),
    errors: z.number().int(),
  }),
})

export type AdminTakeoverPendingOutput = z.infer<typeof AdminTakeoverPendingOutput>
export type AdminTakeoverSendOutput = z.infer<typeof AdminTakeoverSendOutput>
