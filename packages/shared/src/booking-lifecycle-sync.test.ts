/**
 * Sync test: verifies the Deno edge-function mirror
 * (supabase/functions/_shared/booking-lifecycle.ts) stays in lockstep
 * with the canonical shared reducer (packages/shared/src/booking-lifecycle.ts).
 *
 * The Deno file contains no Deno-specific imports so vitest can load it
 * straight from disk. If you change either file and this suite fails,
 * update the other file to match.
 */
import { describe, it, expect } from 'vitest'
import { applyBookingEvent as canonical, type BookingEvent } from './booking-lifecycle'
import { applyBookingEvent as mirror } from '../../../supabase/functions/_shared/booking-lifecycle'
import type { Booking } from './types'

const NOW = new Date('2026-04-21T12:00:00.000Z')

function booking(partial: Partial<Booking> = {}): Booking {
  return {
    id: 'b',
    market_table_id: 't',
    flea_market_id: 'm',
    booked_by: 'u',
    booking_date: '2026-05-01',
    status: 'pending',
    price_sek: 100,
    commission_sek: 12,
    commission_rate: 0.12,
    message: null,
    organizer_note: null,
    stripe_payment_intent_id: 'pi_1',
    payment_status: 'requires_capture',
    expires_at: null,
    created_at: '2026-04-20T00:00:00.000Z',
    ...partial,
  }
}

const states: Booking['status'][] = ['pending', 'confirmed', 'denied', 'cancelled']
const events: BookingEvent[] = [
  { type: 'created', autoAccept: true, paid: true },
  { type: 'created', autoAccept: true, paid: false },
  { type: 'created', autoAccept: false, paid: true },
  { type: 'created', autoAccept: false, paid: false },
  { type: 'stripe.payment_intent.succeeded', autoAccept: true },
  { type: 'stripe.payment_intent.succeeded', autoAccept: false },
  { type: 'stripe.payment_intent.canceled' },
  { type: 'stripe.payment_intent.failed' },
  { type: 'organizer.approve' },
  { type: 'organizer.deny' },
  { type: 'user.cancel' },
]

describe('booking-lifecycle sync', () => {
  for (const status of states) {
    for (const pi of [null, 'pi_1']) {
      for (const ev of events) {
        it(`${status}/pi=${pi}/${ev.type} produces identical patches`, () => {
          const current = booking({ status, stripe_payment_intent_id: pi })
          const a = canonical(current, ev, NOW)
          const b = mirror(current, ev, NOW)
          expect(b).toEqual(a)
        })
      }
    }
  }
})
