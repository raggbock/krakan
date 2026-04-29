import { z } from 'zod'

/**
 * admin-market-edit — admin patches a market's contact info, address,
 * coordinates, and/or opening hours. All sections optional; only what's in
 * the body gets written. Admins bypass the organizer-ownership RLS via
 * service role on the edge.
 */

const ContactPatch = z.object({
  website: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
})

const AddressPatch = z.object({
  street: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().optional(),
})

const LocationPatch = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

const OpeningHourRuleInput = z.object({
  type: z.enum(['weekly', 'biweekly', 'date']),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  anchorDate: z.string().nullable(),
  openTime: z.string(),
  closeTime: z.string(),
})

export const AdminMarketEditInput = z.object({
  marketId: z.string().uuid(),
  patch: z.object({
    /** Rename the market. Slug intentionally not touched — changing it would
     *  break existing URLs. Capped at 200 chars as a defensive limit.
     *  NB: not chaining .trim() because Zod 4 (deno deploy uses 4.3.6) turns
     *  it into a transform that broke module load on the Edge runtime
     *  (BOOT_ERROR on v7-v8 of admin-market-edit). The drawer trims before
     *  calling so this is functionally equivalent. */
    name: z.string().min(1).max(200).optional(),
    contact: ContactPatch.optional(),
    address: AddressPatch.optional(),
    location: LocationPatch.optional(),
    /** When provided, replaces all existing opening_hour_rules for the market. */
    openingHourRules: z.array(OpeningHourRuleInput).optional(),
    /** true = stamp published_at = now() (only if currently null);
     *  false = set published_at = null. Omit to leave alone. */
    publish: z.boolean().optional(),
    /** Set status. Omit to leave alone. */
    status: z.enum(['confirmed', 'unverified', 'closed']).optional(),
  }),
})

export const AdminMarketEditOutput = z.object({
  success: z.literal(true),
})

export type AdminMarketEditInput = z.infer<typeof AdminMarketEditInput>
export type AdminMarketEditOutput = z.infer<typeof AdminMarketEditOutput>
