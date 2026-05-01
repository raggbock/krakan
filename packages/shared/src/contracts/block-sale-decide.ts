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
  /** Count of approved/rejected stands whose decision email failed to send.
   *  Surfaced so the organizer UI can warn them that some applicants may
   *  not have been notified — re-running the decision is safe (idempotent). */
  emailFailures: z.number(),
})
