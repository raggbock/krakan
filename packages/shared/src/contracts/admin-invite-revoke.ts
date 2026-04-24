import { z } from 'zod'

export const AdminInviteRevokeInput = z.object({
  inviteId: z.string().uuid(),
})

export const AdminInviteRevokeOutput = z.object({
  ok: z.literal(true),
})
