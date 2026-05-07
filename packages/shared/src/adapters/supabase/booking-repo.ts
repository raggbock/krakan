/**
 * Supabase adapter for BookingRepo.
 *
 * `applyEvent` performs two round-trips (SELECT then UPDATE) — the same
 * pattern as the original inline edge code.  No Supabase transaction is
 * used; concurrent writes are handled by the optimistic `.eq('status',
 * current.status)` guard on UPDATE (callers that need stricter concurrency
 * can add their own guard via the guard option, but the default preserves
 * the existing contract).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { applyBookingEvent } from '../../booking-lifecycle'
import type { BookingEvent } from '../../booking-lifecycle'
import type { Booking } from '../../types'
import type { BookingRepo } from '../../ports/booking-repo'
import { BookingQuery } from '../../query/booking'

export function createSupabaseBookingRepo(admin: SupabaseClient): BookingRepo {
  return {
    async findById(id) {
      const { data, error } = await admin
        .from('bookings')
        .select(BookingQuery.core.select)
        .eq('id', id)
        .single()
      if (error || !data) return null
      return data as unknown as Booking
    },

    async findByPaymentIntent(paymentIntentId) {
      const { data, error } = await admin
        .from('bookings')
        .select(`${BookingQuery.core.select}, flea_markets!inner(auto_accept_bookings)`)
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()
      if (error || !data) return null
      const { flea_markets, ...bookingData } = data as unknown as Record<string, unknown> & { flea_markets: { auto_accept_bookings: boolean } }
      return {
        booking: bookingData as unknown as Booking,
        autoAccept: !!flea_markets?.auto_accept_bookings,
      }
    },

    async applyEvent(id, event) {
      // SELECT
      const { data: booking, error: fetchErr } = await admin
        .from('bookings')
        .select(BookingQuery.core.select)
        .eq('id', id)
        .single()
      // eslint-disable-next-line no-restricted-syntax -- adapter-level invariant: missing booking after explicit lookup is a data integrity failure, not a user-facing error
      if (fetchErr || !booking) throw new Error(`Booking ${id} not found`)

      const current = booking as unknown as Booking
      const patch = applyBookingEvent(current, event)

      // Empty patch → illegal / already-terminal transition; return current unchanged.
      if (Object.keys(patch).length === 0) return current

      // UPDATE with optimistic concurrency guard. If another writer changed
      // status between our SELECT and this UPDATE, the row won't match and
      // we return the current DB state — matches the pre-RFC edge behavior
      // where `.eq('status', 'pending')` gated mutations on the money path.
      const { data: updated, error: updateErr } = await admin
        .from('bookings')
        .update(patch)
        .eq('id', id)
        .eq('status', current.status)
        .select(BookingQuery.core.select)
        .maybeSingle()
      // eslint-disable-next-line no-restricted-syntax -- adapter-level invariant: update error is a data integrity failure surfaced from Supabase, not a user-facing error
      if (updateErr) throw new Error(`Failed to update booking ${id}`)
      if (!updated) {
        // Lost the race. Re-fetch so the caller sees current truth.
        const { data: refetched } = await admin
          .from('bookings')
          .select(BookingQuery.core.select)
          .eq('id', id)
          .single()
        // eslint-disable-next-line no-restricted-syntax -- adapter-level invariant: booking disappeared between concurrent operations; indicates a data integrity issue
        if (!refetched) throw new Error(`Booking ${id} disappeared after lost update`)
        return refetched as unknown as Booking
      }

      return updated as unknown as Booking
    },
  }
}
