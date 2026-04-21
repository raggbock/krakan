import { z } from 'zod'

/**
 * Input contract for the booking-create edge function.
 *
 * Kept deliberately permissive: date is a YYYY-MM-DD string so Deno, browser
 * and Node all agree on the wire format. UUID shape is validated server-side
 * against the DB — we only check non-empty here.
 */
export const BookingCreateInput = z.object({
  marketTableId: z.string().min(1),
  fleaMarketId: z.string().min(1),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  message: z.string().optional(),
})

/**
 * Output contract for the booking-create edge function.
 *
 * `clientSecret` is only present for paid bookings (free bookings skip Stripe).
 */
export const BookingCreateOutput = z.object({
  bookingId: z.string().min(1),
  clientSecret: z.string().optional(),
})

export type BookingCreateInput = z.infer<typeof BookingCreateInput>
export type BookingCreateOutput = z.infer<typeof BookingCreateOutput>
