import { z } from 'zod'

export const AdminInviteCreateInput = z.object({
  email: z.string().email(),
})

export const AdminInviteCreateOutput = z.object({
  inviteId: z.string().uuid(),
  expiresAt: z.string(),
})
