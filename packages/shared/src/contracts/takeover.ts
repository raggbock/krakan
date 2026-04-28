import { z } from 'zod'

export const TakeoverInfoInput = z.object({ token: z.string().min(20) })
export const TakeoverInfoOutput = z.object({
  name: z.string(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  /**
   * Masked version of the email the takeover invite was originally sent
   * to (e.g. "i••@andrachansen.com"). Lets visitors see which inbox to
   * verify against without exposing the full address — though anyone
   * holding the token URL effectively had access to the full address
   * already, so this is convenience-not-security.
   */
  maskedEmail: z.string().nullable(),
})

export const TakeoverFeedbackInput = z.object({
  token: z.string().min(20),
  email: z.string().email(),
  message: z.string().min(1).max(2000),
})
export const TakeoverFeedbackOutput = z.object({ ok: z.literal(true) })

export const TakeoverRemoveInput = z.object({
  token: z.string().min(20),
  reason: z.string().max(2000).optional(),
})
export const TakeoverRemoveOutput = z.object({ ok: z.literal(true) })

export const TakeoverStartInput = z.object({
  token: z.string().min(20),
  email: z.string().email(),
})
export const TakeoverStartOutput = z.object({
  ok: z.literal(true),
  /** True when a magic-link has been mailed; visitor should check inbox. */
  magicLinkSent: z.boolean(),
})

export const TakeoverVerifyInput = z.object({
  token: z.string().min(20),
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
})
export const TakeoverVerifyOutput = z.object({
  ok: z.literal(true),
  /**
   * After successful code verification we email a magic-link to finish
   * sign-in. The page tells the user to check their inbox.
   */
  magicLinkSent: z.boolean(),
})
