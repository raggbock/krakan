import { z } from 'zod'

export const AdminRevokeInput = z.object({
  userId: z.string().uuid(),
})

export const AdminRevokeOutput = z.object({
  ok: z.literal(true),
})
