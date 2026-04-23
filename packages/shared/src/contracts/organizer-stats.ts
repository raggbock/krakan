import { z } from 'zod'

/**
 * Input contract for the organizer-stats edge function.
 *
 * Fetches PostHog analytics (pageviews, bookings_initiated) for all flea
 * markets owned by the given organizer.
 */
export const OrganizerStatsInput = z.object({
  organizer_id: z.string().min(1),
})

/**
 * Per-market PostHog stats row returned by the edge function.
 */
export const OrganizerStatsMarket = z.object({
  flea_market_id: z.string(),
  name: z.string(),
  pageviews_30d: z.number(),
  pageviews_total: z.number(),
  bookings_initiated_30d: z.number(),
})

/**
 * Output contract for the organizer-stats edge function.
 */
export const OrganizerStatsOutput = z.object({
  markets: z.array(OrganizerStatsMarket),
})

export type OrganizerStatsInput = z.infer<typeof OrganizerStatsInput>
export type OrganizerStatsOutput = z.infer<typeof OrganizerStatsOutput>
export type OrganizerStatsMarket = z.infer<typeof OrganizerStatsMarket>
