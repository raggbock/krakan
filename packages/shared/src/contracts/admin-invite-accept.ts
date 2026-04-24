import { z } from 'zod'

export const AdminInviteAcceptInput = z.object({
  token: z.string().min(20),
})

export const AdminInviteAcceptOutput = z.object({
  ok: z.literal(true),
})
