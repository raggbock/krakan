import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBookingService } from './booking-service'
import type { OpeningHoursContext } from './booking-service'
import { isAppError } from './errors'
import type { Api } from './api'
import type { Booking } from './types'
import type { PaymentGateway, PaymentResult } from './ports/payment'
import type { Telemetry, TelemetryEvent } from './ports/telemetry'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** In-memory PaymentGateway for contract tests. */
function makePaymentGateway(result: PaymentResult = { status: 'succeeded' }): PaymentGateway & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async confirmCardPayment(clientSecret: string): Promise<PaymentResult> {
      calls.push(clientSecret)
      return result
    },
  }
}

/** In-memory Telemetry for contract tests. */
function makeTelemetry(): Telemetry & { events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = []
  return {
    events,
    capture(event: TelemetryEvent) {
      events.push(event)
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
          day_of_week: 6,
          anchor_date: null,
          open_time: '09:00',
          close_time: '15:00',
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
          day_of_week: 6,
          anchor_date: null,
          open_time: '09:00',
          close_time: '15:00',
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
// book() — four-branch contract tests
// ---------------------------------------------------------------------------

const BASE_BOOK_PARAMS = {
  marketTableId: 'tbl-1',
  fleaMarketId: 'mkt-1',
  bookingDate: '2026-12-01',
  tableLabel: 'Bord A',
  marketName: 'Söders Loppis',
}

describe('BookingService.book — free auto-accept', () => {
  it('calls edge endpoint, skips payment gateway, emits telemetry', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-free-auto' })
    const svc = createBookingService({ api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }) })
    const payment = makePaymentGateway()
    const telemetry = makeTelemetry()

    const result = await svc.book({ ...BASE_BOOK_PARAMS, priceSek: 0 }, { payment, telemetry })

    expect(result).toEqual({ bookingId: 'b-free-auto' })
    expect(bookingCreate).toHaveBeenCalledWith(expect.objectContaining({ marketTableId: 'tbl-1' }))
    expect(payment.calls).toHaveLength(0)
    expect(telemetry.events).toHaveLength(1)
    expect(telemetry.events[0].name).toBe('booking_initiated')
    expect(telemetry.events[0].properties).toMatchObject({
      is_free: true,
      price_sek: 0,
      market_name: 'Söders Loppis',
      table_label: 'Bord A',
    })
  })
})

describe('BookingService.book — free manual-accept', () => {
  it('calls edge endpoint without clientSecret, skips payment gateway', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-free-manual' })
    const svc = createBookingService({ api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }) })
    const payment = makePaymentGateway()
    const telemetry = makeTelemetry()

    const result = await svc.book({ ...BASE_BOOK_PARAMS, priceSek: 0 }, { payment, telemetry })

    expect(result).toEqual({ bookingId: 'b-free-manual' })
    expect(payment.calls).toHaveLength(0)
  })
})

describe('BookingService.book — paid auto-accept', () => {
  it('calls edge endpoint, confirms payment via gateway', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-paid-auto', clientSecret: 'pi_auto_secret' })
    const svc = createBookingService({ api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }) })
    const payment = makePaymentGateway({ status: 'succeeded' })
    const telemetry = makeTelemetry()

    const result = await svc.book({ ...BASE_BOOK_PARAMS, priceSek: 200 }, { payment, telemetry })

    expect(result).toEqual({ bookingId: 'b-paid-auto' })
    expect(payment.calls).toEqual(['pi_auto_secret'])
    expect(telemetry.events[0].properties).toMatchObject({ is_free: false, price_sek: 200 })
  })

  it('throws an AppError when payment gateway returns failed', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-fail', clientSecret: 'pi_fail' })
    const svc = createBookingService({ api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }) })
    // 'card_declined' in the error string maps via toAppError → stripe.card_declined
    const payment = makePaymentGateway({ status: 'failed', error: 'card_declined' })
    const telemetry = makeTelemetry()

    let thrown: unknown
    try {
      await svc.book({ ...BASE_BOOK_PARAMS, priceSek: 200 }, { payment, telemetry })
    } catch (e) {
      thrown = e
    }
    expect(isAppError(thrown)).toBe(true)
    if (isAppError(thrown)) expect(thrown.code).toBe('stripe.card_declined')
  })
})

describe('BookingService.book — paid manual-accept', () => {
  it('calls edge endpoint, confirms payment via gateway (manual capture)', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-paid-manual', clientSecret: 'pi_manual_secret' })
    const svc = createBookingService({ api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }) })
    const payment = makePaymentGateway({ status: 'succeeded' })
    const telemetry = makeTelemetry()

    const result = await svc.book({ ...BASE_BOOK_PARAMS, priceSek: 500 }, { payment, telemetry })

    expect(result).toEqual({ bookingId: 'b-paid-manual' })
    expect(payment.calls).toEqual(['pi_manual_secret'])
    expect(telemetry.events[0].name).toBe('booking_initiated')
  })

  it('does not confirm payment when edge function throws', async () => {
    const bookingCreate = vi.fn().mockRejectedValue(new Error('Stripe not configured'))
    const svc = createBookingService({ api: makeApi({ endpoints: { 'booking.create': { invoke: bookingCreate } } as unknown as Api['endpoints'] }) })
    const payment = makePaymentGateway()
    const telemetry = makeTelemetry()

    await expect(
      svc.book({ ...BASE_BOOK_PARAMS, priceSek: 500 }, { payment, telemetry }),
    ).rejects.toThrow('Stripe not configured')
    expect(payment.calls).toHaveLength(0)
  })
})
