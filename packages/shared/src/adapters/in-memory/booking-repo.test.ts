import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryBookingRepo, type InMemoryBookingRepo } from './booking-repo'
import type { Booking } from '../../types'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    market_table_id: 'mt-1',
    flea_market_id: 'fm-1',
    booked_by: 'user-1',
    booking_date: '2026-06-01',
    status: 'pending',
    price_sek: 200,
    commission_sek: 24,
    commission_rate: 0.12,
    message: null,
    organizer_note: null,
    stripe_payment_intent_id: null,
    payment_status: 'free',
    expires_at: null,
    created_at: '2026-04-22T00:00:00Z',
    ...overrides,
  }
}

let repo: InMemoryBookingRepo

beforeEach(() => {
  repo = createInMemoryBookingRepo() as InMemoryBookingRepo
})

// ─── findById ────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('returns null for unknown id', async () => {
    expect(await repo.findById('nope')).toBeNull()
  })

  it('returns the booking when it exists', async () => {
    const b = repo._insert(makeBooking())
    const found = await repo.findById(b.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(b.id)
  })
})

// ─── findByPaymentIntent ─────────────────────────────────────────────────────

describe('findByPaymentIntent', () => {
  it('returns null when no booking owns that intent', async () => {
    repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_other' }))
    expect(await repo.findByPaymentIntent('pi_unknown')).toBeNull()
  })

  it('finds the booking by payment intent id', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_abc', flea_market_id: 'fm-1' }))
    const result = await repo.findByPaymentIntent('pi_abc')
    expect(result?.booking.id).toBe(b.id)
  })

  it('returns autoAccept=false when not set for market', async () => {
    repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_abc', flea_market_id: 'fm-1' }))
    const result = await repo.findByPaymentIntent('pi_abc')
    expect(result?.autoAccept).toBe(false)
  })

  it('returns autoAccept=true when set for market', async () => {
    repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_abc', flea_market_id: 'fm-1' }))
    repo._setAutoAccept('fm-1', true)
    const result = await repo.findByPaymentIntent('pi_abc')
    expect(result?.autoAccept).toBe(true)
  })
})

// ─── applyEvent — created ────────────────────────────────────────────────────

describe('applyEvent: created', () => {
  it('free + auto-accept → confirmed / free', async () => {
    const b = repo._insert(makeBooking({ status: 'pending' }))
    const updated = await repo.applyEvent(b.id, { type: 'created', autoAccept: true, paid: false })
    expect(updated.status).toBe('confirmed')
    expect(updated.payment_status).toBe('free')
    expect(updated.expires_at).toBeNull()
  })

  it('free + manual → pending / free + expires_at', async () => {
    const b = repo._insert(makeBooking({ status: 'pending' }))
    const updated = await repo.applyEvent(b.id, { type: 'created', autoAccept: false, paid: false })
    expect(updated.status).toBe('pending')
    expect(updated.payment_status).toBe('free')
    expect(updated.expires_at).not.toBeNull()
  })

  it('paid + auto-accept → pending / requires_payment + short expiry', async () => {
    const b = repo._insert(makeBooking({ status: 'pending' }))
    const updated = await repo.applyEvent(b.id, { type: 'created', autoAccept: true, paid: true })
    expect(updated.status).toBe('pending')
    expect(updated.payment_status).toBe('requires_payment')
    expect(updated.expires_at).not.toBeNull()
  })

  it('paid + manual → pending / requires_capture + long expiry', async () => {
    const b = repo._insert(makeBooking({ status: 'pending' }))
    const updated = await repo.applyEvent(b.id, { type: 'created', autoAccept: false, paid: true })
    expect(updated.status).toBe('pending')
    expect(updated.payment_status).toBe('requires_capture')
    expect(updated.expires_at).not.toBeNull()
  })
})

// ─── applyEvent — stripe.payment_intent.succeeded ───────────────────────────

describe('applyEvent: stripe.payment_intent.succeeded', () => {
  it('auto-accept → confirmed / captured', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1', payment_status: 'requires_payment' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.succeeded', autoAccept: true })
    expect(updated.status).toBe('confirmed')
    expect(updated.payment_status).toBe('captured')
  })

  it('manual capture → still pending / requires_capture', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1', payment_status: 'requires_capture' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.succeeded', autoAccept: false })
    expect(updated.status).toBe('pending')
    expect(updated.payment_status).toBe('requires_capture')
  })

  it('terminal booking → ignored (empty patch)', async () => {
    const b = repo._insert(makeBooking({ status: 'confirmed' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.succeeded', autoAccept: true })
    // Reducer returns {} for terminal booking → should stay confirmed, no double-capture
    expect(updated.status).toBe('confirmed')
  })
})

// ─── applyEvent — stripe.payment_intent.canceled ────────────────────────────

describe('applyEvent: stripe.payment_intent.canceled', () => {
  it('pending → cancelled', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.canceled' })
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('cancelled')
  })

  it('already cancelled → no-op (idempotent)', async () => {
    const b = repo._insert(makeBooking({ status: 'cancelled', payment_status: 'cancelled' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.canceled' })
    expect(updated.status).toBe('cancelled')
  })

  it('already denied → no-op', async () => {
    const b = repo._insert(makeBooking({ status: 'denied', payment_status: 'cancelled' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.canceled' })
    expect(updated.status).toBe('denied')
  })
})

// ─── applyEvent — stripe.payment_intent.failed ──────────────────────────────

describe('applyEvent: stripe.payment_intent.failed', () => {
  it('pending → cancelled / failed', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.failed' })
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('failed')
  })

  it('already terminal → no-op', async () => {
    const b = repo._insert(makeBooking({ status: 'cancelled', payment_status: 'failed' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.failed' })
    expect(updated.status).toBe('cancelled')
  })
})

// ─── applyEvent — organizer.approve ─────────────────────────────────────────

describe('applyEvent: organizer.approve', () => {
  it('paid pending → confirmed / captured', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1', payment_status: 'requires_capture' }))
    const updated = await repo.applyEvent(b.id, { type: 'organizer.approve' })
    expect(updated.status).toBe('confirmed')
    expect(updated.payment_status).toBe('captured')
  })

  it('free pending → confirmed / free', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: null, payment_status: 'free' }))
    const updated = await repo.applyEvent(b.id, { type: 'organizer.approve' })
    expect(updated.status).toBe('confirmed')
    expect(updated.payment_status).toBe('free')
  })

  it('already confirmed → no-op', async () => {
    const b = repo._insert(makeBooking({ status: 'confirmed', payment_status: 'captured' }))
    const updated = await repo.applyEvent(b.id, { type: 'organizer.approve' })
    expect(updated.status).toBe('confirmed')
  })
})

// ─── applyEvent — organizer.deny ────────────────────────────────────────────

describe('applyEvent: organizer.deny', () => {
  it('pending → denied / cancelled (stripe)', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1', payment_status: 'requires_capture' }))
    const updated = await repo.applyEvent(b.id, { type: 'organizer.deny' })
    expect(updated.status).toBe('denied')
    expect(updated.payment_status).toBe('cancelled')
  })

  it('free pending → denied / free', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: null, payment_status: 'free' }))
    const updated = await repo.applyEvent(b.id, { type: 'organizer.deny' })
    expect(updated.status).toBe('denied')
    expect(updated.payment_status).toBe('free')
  })
})

// ─── applyEvent — user.cancel ────────────────────────────────────────────────

describe('applyEvent: user.cancel', () => {
  it('pending → cancelled (stripe)', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: 'pi_1', payment_status: 'requires_capture' }))
    const updated = await repo.applyEvent(b.id, { type: 'user.cancel' })
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('cancelled')
  })

  it('free pending → cancelled / free', async () => {
    const b = repo._insert(makeBooking({ stripe_payment_intent_id: null, payment_status: 'free' }))
    const updated = await repo.applyEvent(b.id, { type: 'user.cancel' })
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('free')
  })

  it('already denied → no-op (terminal)', async () => {
    const b = repo._insert(makeBooking({ status: 'denied', payment_status: 'free' }))
    const updated = await repo.applyEvent(b.id, { type: 'user.cancel' })
    expect(updated.status).toBe('denied')
  })
})

// ─── race: terminal → applyEvent is ignored ──────────────────────────────────

describe('race conditions', () => {
  it('webhook arrives after booking is already cancelled → no-op', async () => {
    const b = repo._insert(makeBooking({ status: 'cancelled', payment_status: 'cancelled' }))
    const updated = await repo.applyEvent(b.id, { type: 'stripe.payment_intent.succeeded', autoAccept: true })
    expect(updated.status).toBe('cancelled')
    expect(updated.payment_status).toBe('cancelled')
  })

  it('applyEvent on missing id throws', async () => {
    await expect(repo.applyEvent('does-not-exist', { type: 'user.cancel' })).rejects.toThrow()
  })
})
