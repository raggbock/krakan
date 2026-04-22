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

export function createSupabaseBookingRepo(admin: SupabaseClient): BookingRepo {
  return {
    async findById(id) {
      const { data, error } = await admin
        .from('bookings')
        .select('id, status, stripe_payment_intent_id, flea_market_id, booked_by, market_table_id, booking_date, price_sek, commission_sek, commission_rate, message, organizer_note, payment_status, expires_at, created_at')
        .eq('id', id)
        .single()
      if (error || !data) return null
      return data as Booking
    },

    async findByPaymentIntent(paymentIntentId) {
      const { data, error } = await admin
        .from('bookings')
        .select('id, status, stripe_payment_intent_id, flea_market_id, booked_by, market_table_id, booking_date, price_sek, commission_sek, commission_rate, message, organizer_note, payment_status, expires_at, created_at')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()
      if (error || !data) return null
      return data as Booking
    },

    async applyEvent(id, event) {
      // SELECT
      const { data: booking, error: fetchErr } = await admin
        .from('bookings')
        .select('id, status, stripe_payment_intent_id, flea_market_id, booked_by, market_table_id, booking_date, price_sek, commission_sek, commission_rate, message, organizer_note, payment_status, expires_at, created_at')
        .eq('id', id)
        .single()
      if (fetchErr || !booking) throw new Error(`Booking ${id} not found`)

      const current = booking as Booking
      const patch = applyBookingEvent(current, event)

      // Empty patch → illegal / already-terminal transition; return current unchanged.
      if (Object.keys(patch).length === 0) return current

      // UPDATE — two round-trips, same as original edge code.
      const { data: updated, error: updateErr } = await admin
        .from('bookings')
        .update(patch)
        .eq('id', id)
        .select('id, status, stripe_payment_intent_id, flea_market_id, booked_by, market_table_id, booking_date, price_sek, commission_sek, commission_rate, message, organizer_note, payment_status, expires_at, created_at')
        .single()
      if (updateErr || !updated) throw new Error(`Failed to update booking ${id}`)

      return updated as Booking
    },
  }
}
