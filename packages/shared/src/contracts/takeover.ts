import { z } from 'zod'

export const TakeoverInfoInput = z.object({ token: z.string().min(20) })
export const TakeoverInfoOutput = z.object({
  name: z.string(),
  city: z.string().nullable(),
  region: z.string().nullable(),
})

export const TakeoverStartInput = z.object({
  token: z.string().min(20),
  email: z.string().email(),
})
export const TakeoverStartOutput = z.object({
  ok: z.literal(true),
  expiresAt: z.string(),
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
