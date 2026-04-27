import { z } from 'zod'

/**
 * Self-service market creation from /skapa. No JWT required — the magic
 * link sent to the supplied email is what proves ownership before the
 * draft becomes editable. Drafts stay invisible (is_market_visible
 * filters published_at IS NULL) and noindex'd until the owner clicks
 * Publicera, so unverified emails can't pollute the public catalog.
 */
export const PublicMarketCreateInput = z.object({
  name: z.string().min(2).max(120),
  city: z.string().min(1).max(80),
  /** ISO date YYYY-MM-DD. Must be today or in the future. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** HH:MM (24h). */
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  street: z.string().max(200).optional(),
  email: z.string().email(),
})

export const PublicMarketCreateOutput = z.object({
  ok: z.literal(true),
  /** Slug of the newly-created draft. Used by the success page to deep-link. */
  slug: z.string(),
})
