import { z } from 'zod'

/**
 * Visitor-initiated takeover request from a market detail page. Sends
 * an email to admin with the request details. No token issued at this
 * step — admin reviews, then uses admin-takeover-send to actually
 * issue the takeover token to the verified email.
 */
export const TakeoverRequestInput = z.object({
  marketId: z.string().uuid(),
  email: z.string().email(),
  /** "Vad är din koppling till loppisen?" — free-text justification. */
  note: z.string().max(500).optional(),
})

export const TakeoverRequestOutput = z.object({
  ok: z.literal(true),
})
