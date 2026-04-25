import { z } from 'zod'

/**
 * admin-markets-overview — bird's-eye list of every market for the admin
 * dashboard. Includes unpublished, system-owned, and closed markets that the
 * public surface filters out.
 */

export const AdminMarketsOverviewInput = z.object({})

export const TakeoverState = z.object({
  /** A token exists, hasn't been used or invalidated, and hasn't expired. */
  hasActiveToken: z.boolean(),
  /** Owner completed the takeover via the magic-link step. */
  used: z.boolean(),
  /** Token expired before being used. */
  expired: z.boolean(),
  /** Last sent_at on any token for this market (null if never sent). */
  sentAt: z.string().nullable(),
})

const OpeningHourRule = z.object({
  id: z.string(),
  type: z.enum(['weekly', 'biweekly', 'date']),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  anchorDate: z.string().nullable(),
  openTime: z.string(),
  closeTime: z.string(),
})

export const AdminMarketRow = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  name: z.string(),
  city: z.string().nullable(),
  street: z.string().nullable(),
  zipCode: z.string().nullable(),
  country: z.string().nullable(),
  status: z.string(),
  category: z.string().nullable(),
  isSystemOwned: z.boolean(),
  isPublished: z.boolean(),
  isPermanent: z.boolean(),
  // Editable contact values (presence flags below for summary).
  contactWebsite: z.string().nullable(),
  contactFacebook: z.string().nullable(),
  contactInstagram: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  hasWebsite: z.boolean(),
  hasFacebook: z.boolean(),
  hasInstagram: z.boolean(),
  hasPhone: z.boolean(),
  hasEmail: z.boolean(),
  hasOpeningHours: z.boolean(),
  hasCoordinates: z.boolean(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  openingHourRules: z.array(OpeningHourRule),
  /** null when the market is owned (not system_owned) — takeover doesn't apply. */
  takeover: TakeoverState.nullable(),
  updatedAt: z.string().nullable(),
})

export const AdminMarketsOverviewOutput = z.object({
  markets: z.array(AdminMarketRow),
})

export type AdminMarketRow = z.infer<typeof AdminMarketRow>
export type AdminMarketsOverviewOutput = z.infer<typeof AdminMarketsOverviewOutput>
