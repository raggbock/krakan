import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBookingService } from './booking-service'
import type { BookingProgress, OpeningHoursContext } from './booking-service'
import { isAppError } from '../errors'
import type { Api } from '../api'
import type { Booking } from '../types'
import type { PaymentGateway } from '../ports/payment'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all events from a BookingProgress AsyncIterable. */
async function collect(stream: AsyncIterable<BookingProgress>): Promise<BookingProgress[]> {
  const out: BookingProgress[] = []
  for await (const e of stream) out.push(e)
  return out
}

/** In-memory PaymentGateway that resolves (success) or rejects (failure). */
function makePaymentGateway(mode: 'succeed' | 'fail' | 'throw' = 'succeed'): PaymentGateway & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async confirmCardPayment(clientSecret: string): Promise<void> {
      calls.push(clientSecret)
      if (mode === 'fail' || mode === 'throw') {
        throw new Error('card_declined')
      }
    },
  }
}

function makeApi(overrides: Partial<Api> = {}): Api {
  return {
    bookings: {
      create: vi.fn(),
      listByUser: vi.fn(),
      listByMarket: vi.fn(),
      updateStatus: vi.fn(),
      availableDates: vi.fn().mockResolvedValue([]),
    },
    endpoints: {
      'booking.create': { invoke: vi.fn().mockResolvedValue({ bookingId: 'b-1' }) },
    },
    edge: {
      invoke: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as Api
}

// ---------------------------------------------------------------------------
// calculateTotal
// ---------------------------------------------------------------------------

describe('BookingService.calculateTotal', () => {
  it('returns zeros for a free table', () => {
    const svc = createBookingService({ api: makeApi() })
    expect(svc.calculateTotal(0)).toEqual({ price: 0, commission: 0, total: 0 })
  })

  it('applies 12% commission for a paid table', () => {
    const svc = createBookingService({ api: makeApi() })
    // 200 * 0.12 = 24 (rounded) → total 224
    expect(svc.calculateTotal(200)).toEqual({ price: 200, commission: 24, total: 224 })
  })

  it('rounds commission correctly for a high-value table', () => {
    const svc = createBookingService({ api: makeApi() })
    // 1500 * 0.12 = 180 → total 1680
    expect(svc.calculateTotal(1500)).toEqual({ price: 1500, commission: 180, total: 1680 })
  })
})

// ---------------------------------------------------------------------------
// validateDate
// ---------------------------------------------------------------------------

describe('BookingService.validateDate', () => {
  it('rejects a past date', () => {
    const svc = createBookingService({ api: makeApi() })
    const result = svc.validateDate('2020-01-01', [], '2026-04-21')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('booking.date.in_past')
  })

  it('rejects an already-booked date', () => {
    const svc = createBookingService({ api: makeApi() })
    const result = svc.validateDate('2026-12-01', ['2026-12-01'], '2026-04-21')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('booking.date.already_booked')
  })

  it('accepts a valid future date', () => {
    const svc = createBookingService({ api: makeApi() })
    expect(svc.validateDate('2026-12-01', [], '2026-04-21')).toEqual({ valid: true })
  })

  it('rejects a closed day when opening hours context is provided', () => {
    // 2026-12-01 is a Tuesday (day 2); market only opens on Saturdays
    const openingHours: OpeningHoursContext = {
      rules: [
        {
          id: 'r1',
          type: 'weekly',
          dayOfWeek: 6,
          anchorDate: null,
          openTime: '09:00',
          closeTime: '15:00',
        },
      ],
      exceptions: [],
    }
    const svc = createBookingService({ api: makeApi() })
    const result = svc.validateDate('2026-12-01', [], '2026-04-21', openingHours)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.code).toBe('booking.market_closed')
  })

  it('accepts an open day when opening hours context is provided', () => {
    // 2026-12-05 is a Saturday
    const openingHours: OpeningHoursContext = {
      rules: [
        {
          id: 'r1',
          type: 'weekly',
          dayOfWeek: 6,
          anchorDate: null,
          openTime: '09:00',
          closeTime: '15:00',
        },
      ],
      exceptions: [],
    }
    const svc = createBookingService({ api: makeApi() })
    const result = svc.validateDate('2026-12-05', [], '2026-04-21', openingHours)
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// createWithPayment
// ---------------------------------------------------------------------------

describe('BookingService.createWithPayment', () => {
  it('forwards params to api.endpoints[booking.create].invoke', async () => {
    const invoke = vi.fn().mockResolvedValue({ bookingId: 'b-42', clientSecret: 'pi_sec' })
    const api = makeApi({ endpoints: { 'booking.create': { invoke } } as unknown as Api['endpoints'] })
    const svc = createBookingService({ api })

    const result = await svc.createWithPayment({
      marketTableId: 'tbl-1',
      fleaMarketId: 'mkt-1',
      bookingDate: '2026-12-01',
      message: 'Hej',
    })

    expect(invoke).toHaveBeenCalledWith({
      marketTableId: 'tbl-1',
      fleaMarketId: 'mkt-1',
      bookingDate: '2026-12-01',
      message: 'Hej',
    })
    expect(result).toEqual({ bookingId: 'b-42', clientSecret: 'pi_sec' })
  })

  it('propagates the free-booking response (no clientSecret)', async () => {
    const invoke = vi.fn().mockResolvedValue({ bookingId: 'b-free' })
    const api = makeApi({ endpoints: { 'booking.create': { invoke } } as unknown as Api['endpoints'] })
    const svc = createBookingService({ api })

    const result = await svc.createWithPayment({
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })
    expect(result).toEqual({ bookingId: 'b-free' })
    expect(result.clientSecret).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

describe('BookingService.capture', () => {
  it('invokes stripe.payment.capture endpoint with the booking id', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const api = makeApi({
      endpoints: {
        'booking.create': { invoke: vi.fn().mockResolvedValue({ bookingId: 'b-1' }) },
        'stripe.payment.capture': { invoke },
        'stripe.payment.cancel': { invoke: vi.fn() },
      } as unknown as Api['endpoints'],
    })
    const svc = createBookingService({ api })

    await svc.capture('booking-123')

    expect(invoke).toHaveBeenCalledWith({ bookingId: 'booking-123' })
  })
})

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe('BookingService.cancel', () => {
  it('invokes stripe.payment.cancel endpoint with newStatus=denied', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const api = makeApi({
      endpoints: {
        'booking.create': { invoke: vi.fn().mockResolvedValue({ bookingId: 'b-1' }) },
        'stripe.payment.capture': { invoke: vi.fn() },
        'stripe.payment.cancel': { invoke },
      } as unknown as Api['endpoints'],
    })
    const svc = createBookingService({ api })

    await svc.cancel('booking-456', 'denied')

    expect(invoke).toHaveBeenCalledWith({
      bookingId: 'booking-456',
      newStatus: 'denied',
    })
  })

  it('invokes stripe.payment.cancel endpoint with newStatus=cancelled', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const api = makeApi({
      endpoints: {
        'booking.create': { invoke: vi.fn().mockResolvedValue({ bookingId: 'b-1' }) },
        'stripe.payment.capture': { invoke: vi.fn() },
        'stripe.payment.cancel': { invoke },
      } as unknown as Api['endpoints'],
    })
    const svc = createBookingService({ api })

    await svc.cancel('booking-789', 'cancelled')

    expect(invoke).toHaveBeenCalledWith({
      bookingId: 'booking-789',
      newStatus: 'cancelled',
    })
  })
})

// ---------------------------------------------------------------------------
// applyEvent — pass-through of lifecycle reducer
// ---------------------------------------------------------------------------

describe('BookingService.applyEvent', () => {
  it('is a pass-through to applyBookingEvent', () => {
    const svc = createBookingService({ api: makeApi() })
    const booking: Booking = {
      id: 'b-1',
      market_table_id: 'tbl-1',
      flea_market_id: 'mkt-1',
      booked_by: 'user-1',
      booking_date: '2026-12-01',
      status: 'pending',
      price_sek: 200,
      commission_sek: 24,
      commission_rate: 0.12,
      message: null,
      organizer_note: null,
      stripe_payment_intent_id: null,
      payment_status: 'free',
      expires_at: null,
      created_at: '2026-04-01T00:00:00Z',
    }
    const patch = svc.applyEvent(booking, { type: 'user.cancel' })
    expect(patch).toMatchObject({ status: 'cancelled', payment_status: 'free' })
    expect(patch.cancelled_at).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// book() — event-stream contract tests
// ---------------------------------------------------------------------------

const BASE_BOOK_PARAMS = {
  marketTableId: 'tbl-1',
  fleaMarketId: 'mkt-1',
  bookingDate: '2026-12-01',
  tableLabel: 'Bord A',
  marketName: 'Söders Loppis',
}

describe('BookingService.book — free booking', () => {
  it('yields [submitted, created{requiresPayment:false}, succeeded{requiresPayment:false}]', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-free-auto' })
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway()

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 0 }, { payment }))

    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ type: 'submitted', input: expect.objectContaining({ priceSek: 0 }) })
    expect(events[1]).toMatchObject({ type: 'created', bookingId: 'b-free-auto', requiresPayment: false, amountOre: 0 })
    expect(events[2]).toMatchObject({ type: 'succeeded', bookingId: 'b-free-auto', requiresPayment: false })

    // Payment gateway must NOT be called for free bookings
    expect(payment.calls).toHaveLength(0)
  })

  it('passes correct createParams to the API (strips telemetry-only fields)', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-free' })
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway()

    await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 0 }, { payment }))

    expect(bookingCreate).toHaveBeenCalledWith({
      marketTableId: 'tbl-1',
      fleaMarketId: 'mkt-1',
      bookingDate: '2026-12-01',
    })
    // tableLabel and marketName must NOT be forwarded to the API
    expect(bookingCreate).not.toHaveBeenCalledWith(expect.objectContaining({ tableLabel: expect.anything() }))
    expect(bookingCreate).not.toHaveBeenCalledWith(expect.objectContaining({ marketName: expect.anything() }))
  })
})

describe('BookingService.book — paid booking (happy path)', () => {
  it('yields [submitted, created{requiresPayment:true}, payment-required, payment-confirmed, succeeded{requiresPayment:true}]', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-paid', clientSecret: 'pi_auto_secret' })
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway('succeed')

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 200 }, { payment }))

    expect(events).toHaveLength(5)
    expect(events[0]).toMatchObject({ type: 'submitted' })
    expect(events[1]).toMatchObject({ type: 'created', bookingId: 'b-paid', requiresPayment: true, amountOre: 22400 })
    expect(events[2]).toMatchObject({ type: 'payment-required', bookingId: 'b-paid', clientSecret: 'pi_auto_secret', amountOre: 22400 })
    expect(events[3]).toMatchObject({ type: 'payment-confirmed', bookingId: 'b-paid', amountOre: 22400 })
    expect(events[4]).toMatchObject({ type: 'succeeded', bookingId: 'b-paid', requiresPayment: true })

    expect(payment.calls).toEqual(['pi_auto_secret'])
  })
})

describe('BookingService.book — API failure (booking.create throws)', () => {
  it('yields [submitted, failed{stage:"create"}]', async () => {
    const bookingCreate = vi.fn().mockRejectedValue(new Error('Stripe not configured'))
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway()

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 500 }, { payment }))

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'submitted' })
    expect(events[1]).toMatchObject({ type: 'failed', stage: 'create' })
    expect(isAppError((events[1] as { error: unknown }).error)).toBe(true)

    // Payment gateway must NOT be called when the create call fails
    expect(payment.calls).toHaveLength(0)
  })

  it('maps known error messages to specific AppError codes', async () => {
    const bookingCreate = vi.fn().mockRejectedValue(new Error('network error'))
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway()

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 200 }, { payment }))

    const failed = events[1] as Extract<typeof events[1], { type: 'failed' }>
    expect(failed.type).toBe('failed')
    expect(failed.error.code).toBe('stripe.network_error')
  })
})

describe('BookingService.book — Stripe payment failure', () => {
  it('yields [submitted, created, payment-required, failed{stage:"payment"}]', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-fail', clientSecret: 'pi_fail' })
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway('fail')

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 200 }, { payment }))

    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({ type: 'submitted' })
    expect(events[1]).toMatchObject({ type: 'created', bookingId: 'b-fail', requiresPayment: true })
    expect(events[2]).toMatchObject({ type: 'payment-required', bookingId: 'b-fail' })
    expect(events[3]).toMatchObject({ type: 'failed', stage: 'payment' })

    const failed = events[3] as Extract<typeof events[3], { type: 'failed' }>
    expect(isAppError(failed.error)).toBe(true)
    expect(failed.error.code).toBe('stripe.card_declined')
  })
})

describe('BookingService.book — amountOre calculation', () => {
  it('computes amountOre as (price + commission) * 100', async () => {
    // 200 SEK + 24 SEK commission = 224 SEK = 22400 öre
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-1', clientSecret: 'pi_1' })
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway('succeed')

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 200 }, { payment }))

    const created = events.find((e) => e.type === 'created') as Extract<typeof events[0], { type: 'created' }>
    expect(created.amountOre).toBe(22400)
  })

  it('sets amountOre to 0 for free bookings', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-free' })
    const svc = createBookingService({
      api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }),
    })
    const payment = makePaymentGateway()

    const events = await collect(svc.book({ ...BASE_BOOK_PARAMS, priceSek: 0 }, { payment }))

    const created = events.find((e) => e.type === 'created') as Extract<typeof events[0], { type: 'created' }>
    expect(created.amountOre).toBe(0)
  })
})
