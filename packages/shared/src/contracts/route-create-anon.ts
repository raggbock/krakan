import { z } from 'zod'

/**
 * Anonymous route creation from /rundor/skapa. No JWT required — a magic
 * link is sent to the supplied email. The user clicks it to sign in and
 * view their saved route. Mirrors the public-market-create pattern.
 */
export const RouteCreateAnonInput = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startLatitude: z.number().optional(),
  startLongitude: z.number().optional(),
  marketIds: z.array(z.string().uuid()).min(1).max(50),
  // Honeypot — must be empty/absent. Bots fill hidden fields; humans don't.
  website: z.string().max(0).optional(),
})

export const RouteCreateAnonOutput = z.object({
  ok: z.literal(true),
  routeId: z.string(),
})
