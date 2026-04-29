/**
 * BookingLifecycle — pure reducer for (booking, event) → patch.
 *
 * Canonical source for booking state transitions. Every edge function that
 * mutates a booking row should translate its trigger (API call, Stripe
 * webhook, organizer action) into a BookingEvent and feed it through
 * `applyBookingEvent` to compute the database patch.
 *
 * Deno edge functions import this file directly via the import map in
 * supabase/functions/deno.json — no mirror needed.
 */

import type { Booking, BookingStatus, PaymentStatus } from './types'
import { decideCreateBooking } from './booking'

// Events that drive the lifecycle.
// Note: the 'created' event is here for the BookingRepo.applyEvent port
// (the in-memory + Supabase adapters route booking creation through it).
// Direct callers that have the price should prefer decideCreateBooking
// in ./booking.ts — it returns a richer decision (captureMethod, needsStripe)
// without needing a synthetic current-row.
export type BookingEvent =
  | { type: 'created'; autoAccept: boolean; paid: boolean }
  | { type: 'stripe.payment_intent.succeeded'; autoAccept: boolean }
  | { type: 'stripe.payment_intent.canceled' }
  | { type: 'stripe.payment_intent.failed' }
  | { type: 'organizer.approve' }
  | { type: 'organizer.deny' }
  | { type: 'user.cancel' }

// Subset of `Booking` columns the reducer may patch. Timestamp columns
// (captured_at, cancelled_at, denied_at) are stamped as ISO strings but are
// not present on the `Booking` row type — they exist only in the DB schema
// and are surfaced here so the patch carries them through to the UPDATE.
export type BookingPatch = Partial<{
  status: BookingStatus
  payment_status: PaymentStatus
  expires_at: string | null
  captured_at: string
  cancelled_at: string
  denied_at: string
}>

/**
 * Pure reducer. Given the current booking row and an event, return the
 * patch to apply. Returns {} for illegal transitions so the caller can
 * safely pass the result to `.update()` — the UPDATE becomes a no-op.
 * Never mutates `current`.
 *
 * @param now injectable clock for deterministic testing.
 */
export function applyBookingEvent(
  current: Booking,
  event: BookingEvent,
  now: Date = new Date(),
): BookingPatch {
  switch (event.type) {
    case 'created': {
      // Delegates to the canonical decideCreateBooking. The reducer doesn't
      // know the price, only `paid: boolean` — pass a sentinel that
      // isFreePriced will classify correctly. New code with access to the
      // price should call decideCreateBooking directly.
      const d = decideCreateBooking({
        priceSek: event.paid ? 1 : 0,
        autoAccept: event.autoAccept,
        now,
      })
      return { status: d.status, payment_status: d.paymentStatus, expires_at: d.expiresAt }
    }

    case 'stripe.payment_intent.succeeded': {
      // Applies to bookings that were awaiting payment. If the current
      // status is already terminal we ignore (webhook racing).
      if (current.status !== 'pending') return {}
      if (event.autoAccept) {
        return {
          status: 'confirmed',
          payment_status: 'captured',
          captured_at: now.toISOString(),
        }
      }
      // Manual capture flow: card authorized, awaiting organizer approval.
      return { payment_status: 'requires_capture' }
    }

    case 'stripe.payment_intent.canceled': {
      if (current.status === 'cancelled' || current.status === 'denied') return {}
      return {
        status: 'cancelled',
        payment_status: 'cancelled',
        cancelled_at: now.toISOString(),
      }
    }

    case 'stripe.payment_intent.failed': {
      if (current.status === 'cancelled' || current.status === 'denied') return {}
      return {
        status: 'cancelled',
        payment_status: 'failed',
        cancelled_at: now.toISOString(),
      }
    }

    case 'organizer.approve': {
      if (current.status !== 'pending') return {}
      // Paid bookings in manual-capture flow: Stripe capture happens
      // alongside this patch; reducer records the domain outcome.
      const hasStripe = current.stripe_payment_intent_id !== null
      return {
        status: 'confirmed',
        payment_status: hasStripe ? 'captured' : 'free',
        captured_at: now.toISOString(),
      }
    }

    case 'organizer.deny': {
      if (current.status !== 'pending') return {}
      return {
        status: 'denied',
        payment_status: current.stripe_payment_intent_id ? 'cancelled' : 'free',
        denied_at: now.toISOString(),
      }
    }

    case 'user.cancel': {
      // Users can cancel while pending (and while confirmed, per existing
      // ALLOWED_TRANSITIONS). Terminal states are illegal.
      if (current.status === 'cancelled' || current.status === 'denied') return {}
      return {
        status: 'cancelled',
        payment_status: current.stripe_payment_intent_id ? 'cancelled' : 'free',
        cancelled_at: now.toISOString(),
      }
    }
  }
}
