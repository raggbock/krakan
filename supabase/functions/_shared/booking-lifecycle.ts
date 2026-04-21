/**
 * BookingLifecycle reducer — Deno mirror of
 * packages/shared/src/booking-lifecycle.ts
 *
 * Edge functions (Deno) cannot import from @fyndstigen/shared directly.
 * This file MUST stay in sync with the canonical TS version. Any change
 * to the event list, state transitions, or patch shape must be reflected
 * here. Rule of thumb: if you'd update this file, also update
 * packages/shared/src/booking-lifecycle.ts (and vice-versa), and re-run
 * packages/shared/src/booking-lifecycle.test.ts.
 *
 * See also: _shared/pricing.ts ↔ packages/shared/src/booking.ts for the
 * same mirroring pattern.
 */

export type BookingStatus = 'pending' | 'confirmed' | 'denied' | 'cancelled'
export type PaymentStatus =
  | 'requires_capture'
  | 'requires_payment'
  | 'captured'
  | 'cancelled'
  | 'failed'
  | 'free'

// Minimum shape of a booking row the reducer needs to inspect.
export type BookingLike = {
  status: BookingStatus
  stripe_payment_intent_id: string | null
}

export type BookingEvent =
  | { type: 'created'; autoAccept: boolean; paid: boolean }
  | { type: 'stripe.payment_intent.succeeded'; autoAccept: boolean }
  | { type: 'stripe.payment_intent.canceled' }
  | { type: 'stripe.payment_intent.failed' }
  | { type: 'organizer.approve' }
  | { type: 'organizer.deny' }
  | { type: 'user.cancel' }

export type BookingPatch = Partial<{
  status: BookingStatus
  payment_status: PaymentStatus
  expires_at: string | null
  captured_at: string
  cancelled_at: string
  denied_at: string
}>

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(days: number, now: Date): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString()
}

export function applyBookingEvent(
  current: BookingLike,
  event: BookingEvent,
  now: Date = new Date(),
): BookingPatch {
  switch (event.type) {
    case 'created': {
      const { autoAccept, paid } = event
      if (!paid && autoAccept) {
        return { status: 'confirmed', payment_status: 'free', expires_at: null }
      }
      if (!paid && !autoAccept) {
        return { status: 'pending', payment_status: 'free', expires_at: addDays(7, now) }
      }
      if (paid && autoAccept) {
        return { status: 'pending', payment_status: 'requires_payment', expires_at: addDays(1, now) }
      }
      return { status: 'pending', payment_status: 'requires_capture', expires_at: addDays(7, now) }
    }

    case 'stripe.payment_intent.succeeded': {
      if (current.status !== 'pending') return {}
      if (event.autoAccept) {
        return {
          status: 'confirmed',
          payment_status: 'captured',
          captured_at: now.toISOString(),
        }
      }
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
      if (current.status === 'cancelled' || current.status === 'denied') return {}
      return {
        status: 'cancelled',
        payment_status: current.stripe_payment_intent_id ? 'cancelled' : 'free',
        cancelled_at: now.toISOString(),
      }
    }
  }
}
