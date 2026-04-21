import { describe, it, expect } from 'vitest'
import { applyBookingEvent, type BookingEvent, type BookingPatch } from './booking-lifecycle'
import type { Booking, BookingStatus } from './types'

const FIXED_NOW = new Date('2026-04-21T12:00:00.000Z')

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    market_table_id: 'table-1',
    flea_market_id: 'market-1',
    booked_by: 'user-1',
    booking_date: '2026-05-01',
    status: 'pending',
    price_sek: 100,
    commission_sek: 12,
    commission_rate: 0.12,
    message: null,
    organizer_note: null,
    stripe_payment_intent_id: 'pi_123',
    payment_status: 'requires_capture',
    expires_at: null,
    created_at: '2026-04-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('applyBookingEvent — created', () => {
  it('free + auto-accept → confirmed, free, no expiry', () => {
    const b = makeBooking({ status: 'pending', stripe_payment_intent_id: null })
    const patch = applyBookingEvent(b, { type: 'created', autoAccept: true, paid: false }, FIXED_NOW)
    expect(patch).toEqual({ status: 'confirmed', payment_status: 'free', expires_at: null })
  })

  it('free + manual → pending, free, +7d', () => {
    const b = makeBooking({ stripe_payment_intent_id: null })
    const patch = applyBookingEvent(b, { type: 'created', autoAccept: false, paid: false }, FIXED_NOW)
    expect(patch.status).toBe('pending')
    expect(patch.payment_status).toBe('free')
    expect(patch.expires_at).toBe('2026-04-28T12:00:00.000Z')
  })

  it('paid + auto-accept → pending, requires_payment, +1d', () => {
    const b = makeBooking()
    const patch = applyBookingEvent(b, { type: 'created', autoAccept: true, paid: true }, FIXED_NOW)
    expect(patch.status).toBe('pending')
    expect(patch.payment_status).toBe('requires_payment')
    expect(patch.expires_at).toBe('2026-04-22T12:00:00.000Z')
  })

  it('paid + manual → pending, requires_capture, +7d', () => {
    const b = makeBooking()
    const patch = applyBookingEvent(b, { type: 'created', autoAccept: false, paid: true }, FIXED_NOW)
    expect(patch.status).toBe('pending')
    expect(patch.payment_status).toBe('requires_capture')
    expect(patch.expires_at).toBe('2026-04-28T12:00:00.000Z')
  })
})

describe('applyBookingEvent — stripe.payment_intent.succeeded', () => {
  it('auto-accept market → confirm + capture stamp', () => {
    const b = makeBooking({ status: 'pending' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.succeeded', autoAccept: true }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'confirmed',
      payment_status: 'captured',
      captured_at: FIXED_NOW.toISOString(),
    })
  })

  it('manual market → only flag requires_capture', () => {
    const b = makeBooking({ status: 'pending' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.succeeded', autoAccept: false }, FIXED_NOW)
    expect(patch).toEqual({ payment_status: 'requires_capture' })
  })

  it('already cancelled → no-op', () => {
    const b = makeBooking({ status: 'cancelled' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.succeeded', autoAccept: true }, FIXED_NOW)
    expect(patch).toEqual({})
  })

  it('already confirmed → no-op (duplicate webhook)', () => {
    const b = makeBooking({ status: 'confirmed' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.succeeded', autoAccept: true }, FIXED_NOW)
    expect(patch).toEqual({})
  })
})

describe('applyBookingEvent — stripe.payment_intent.canceled / failed', () => {
  it('canceled from pending → cancel', () => {
    const b = makeBooking({ status: 'pending' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.canceled' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'cancelled',
      payment_status: 'cancelled',
      cancelled_at: FIXED_NOW.toISOString(),
    })
  })

  it('failed from pending → cancel w/ failed payment status', () => {
    const b = makeBooking({ status: 'pending' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.failed' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'cancelled',
      payment_status: 'failed',
      cancelled_at: FIXED_NOW.toISOString(),
    })
  })

  it('canceled after already cancelled → no-op', () => {
    const b = makeBooking({ status: 'cancelled' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.canceled' }, FIXED_NOW)
    expect(patch).toEqual({})
  })

  it('canceled after denied → no-op', () => {
    const b = makeBooking({ status: 'denied' })
    const patch = applyBookingEvent(b, { type: 'stripe.payment_intent.canceled' }, FIXED_NOW)
    expect(patch).toEqual({})
  })
})

describe('applyBookingEvent — organizer.approve / deny', () => {
  it('approve pending (paid) → confirmed, captured', () => {
    const b = makeBooking({ status: 'pending', stripe_payment_intent_id: 'pi_123' })
    const patch = applyBookingEvent(b, { type: 'organizer.approve' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'confirmed',
      payment_status: 'captured',
      captured_at: FIXED_NOW.toISOString(),
    })
  })

  it('approve pending (free) → confirmed, free', () => {
    const b = makeBooking({ status: 'pending', stripe_payment_intent_id: null })
    const patch = applyBookingEvent(b, { type: 'organizer.approve' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'confirmed',
      payment_status: 'free',
      captured_at: FIXED_NOW.toISOString(),
    })
  })

  it('approve when already cancelled → no-op', () => {
    const b = makeBooking({ status: 'cancelled' })
    expect(applyBookingEvent(b, { type: 'organizer.approve' }, FIXED_NOW)).toEqual({})
  })

  it('approve when already confirmed → no-op', () => {
    const b = makeBooking({ status: 'confirmed' })
    expect(applyBookingEvent(b, { type: 'organizer.approve' }, FIXED_NOW)).toEqual({})
  })

  it('deny pending (paid) → denied, payment cancelled', () => {
    const b = makeBooking({ status: 'pending', stripe_payment_intent_id: 'pi_123' })
    const patch = applyBookingEvent(b, { type: 'organizer.deny' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'denied',
      payment_status: 'cancelled',
      denied_at: FIXED_NOW.toISOString(),
    })
  })

  it('deny pending (free) → denied, free', () => {
    const b = makeBooking({ status: 'pending', stripe_payment_intent_id: null })
    const patch = applyBookingEvent(b, { type: 'organizer.deny' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'denied',
      payment_status: 'free',
      denied_at: FIXED_NOW.toISOString(),
    })
  })

  it('deny when confirmed → no-op', () => {
    const b = makeBooking({ status: 'confirmed' })
    expect(applyBookingEvent(b, { type: 'organizer.deny' }, FIXED_NOW)).toEqual({})
  })
})

describe('applyBookingEvent — user.cancel', () => {
  it('cancel pending (paid) → cancelled, stripe payment cancelled', () => {
    const b = makeBooking({ status: 'pending' })
    const patch = applyBookingEvent(b, { type: 'user.cancel' }, FIXED_NOW)
    expect(patch).toEqual({
      status: 'cancelled',
      payment_status: 'cancelled',
      cancelled_at: FIXED_NOW.toISOString(),
    })
  })

  it('cancel confirmed (paid) → cancelled', () => {
    const b = makeBooking({ status: 'confirmed', payment_status: 'captured' })
    const patch = applyBookingEvent(b, { type: 'user.cancel' }, FIXED_NOW)
    expect(patch.status).toBe('cancelled')
  })

  it('cancel already cancelled → no-op', () => {
    const b = makeBooking({ status: 'cancelled' })
    expect(applyBookingEvent(b, { type: 'user.cancel' }, FIXED_NOW)).toEqual({})
  })

  it('cancel denied → no-op', () => {
    const b = makeBooking({ status: 'denied' })
    expect(applyBookingEvent(b, { type: 'user.cancel' }, FIXED_NOW)).toEqual({})
  })
})

describe('applyBookingEvent — purity', () => {
  it('never mutates input booking', () => {
    const b = makeBooking({ status: 'pending' })
    const snapshot = JSON.parse(JSON.stringify(b))
    applyBookingEvent(b, { type: 'organizer.approve' }, FIXED_NOW)
    applyBookingEvent(b, { type: 'user.cancel' }, FIXED_NOW)
    applyBookingEvent(b, { type: 'stripe.payment_intent.succeeded', autoAccept: true }, FIXED_NOW)
    expect(b).toEqual(snapshot)
  })
})

describe('applyBookingEvent — full coverage matrix', () => {
  // Exhaustive (state × event) sanity check — asserts we never accidentally
  // produce a patch for a terminal booking.
  const terminalStates: BookingStatus[] = ['cancelled', 'denied']
  const allEvents: BookingEvent[] = [
    { type: 'stripe.payment_intent.succeeded', autoAccept: true },
    { type: 'stripe.payment_intent.succeeded', autoAccept: false },
    { type: 'stripe.payment_intent.canceled' },
    { type: 'stripe.payment_intent.failed' },
    { type: 'organizer.approve' },
    { type: 'organizer.deny' },
    { type: 'user.cancel' },
  ]

  for (const state of terminalStates) {
    for (const ev of allEvents) {
      it(`${state} + ${ev.type} → no-op`, () => {
        const b = makeBooking({ status: state })
        const patch: BookingPatch = applyBookingEvent(b, ev, FIXED_NOW)
        expect(patch).toEqual({})
      })
    }
  }
})
