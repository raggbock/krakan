/**
 * BookingRepo — port for lifecycle-aware booking persistence.
 *
 * `applyEvent` is the canonical write path: it loads the current booking
 * row, feeds it through the booking-lifecycle reducer, and persists the
 * resulting patch.  Each edge function that mutates a booking row calls
 * this method instead of rolling its own SELECT+reducer+UPDATE.
 *
 * Atomicity: the underlying adapter performs two separate DB round-trips
 * (SELECT then UPDATE) — the same pattern as the original inline code.
 * There is no transaction wrapper; concurrent mutations are handled by
 * the `.eq('status', 'pending')` guard in the UPDATE (optimistic
 * concurrency), exactly as the original edges do.
 */

import type { Booking } from '../types'
import type { BookingEvent } from '../booking-lifecycle'

export interface BookingRepo {
  /**
   * Find a booking by its primary key. Returns null if not found.
   */
  findById(id: string): Promise<Booking | null>

  /**
   * Find a booking by its Stripe PaymentIntent ID. Returns null if not found
   * or if no booking owns that intent.
   */
  findByPaymentIntent(paymentIntentId: string): Promise<Booking | null>

  /**
   * Apply a lifecycle event to the booking identified by `id`.
   *
   * Internally: SELECT booking → applyBookingEvent → UPDATE patch.
   * If the reducer returns an empty patch (illegal transition / already
   * terminal) the UPDATE is skipped and the current booking is returned
   * unchanged.
   *
   * Throws if the booking does not exist or if the DB UPDATE fails.
   */
  applyEvent(id: string, event: BookingEvent): Promise<Booking>
}
