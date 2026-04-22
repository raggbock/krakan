import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBookingService } from './booking-service'
import type { OpeningHoursContext } from './booking-service'
import type { Api } from './api'
import type { Booking } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      bookingCreate: vi.fn().mockResolvedValue({ bookingId: 'b-1' }),
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
    expect(result.error).toMatch(/förflutna/)
  })

  it('rejects an already-booked date', () => {
    const svc = createBookingService({ api: makeApi() })
    const result = svc.validateDate('2026-12-01', ['2026-12-01'], '2026-04-21')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/bokat/)
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
    expect(result.error).toMatch(/stängd/)
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
  it('forwards params to api.endpoints.bookingCreate', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-42', clientSecret: 'pi_sec' })
    const api = makeApi({ endpoints: { bookingCreate } as unknown as Api['endpoints'] })
    const svc = createBookingService({ api })

    const result = await svc.createWithPayment({
      marketTableId: 'tbl-1',
      fleaMarketId: 'mkt-1',
      bookingDate: '2026-12-01',
      message: 'Hej',
    })

    expect(bookingCreate).toHaveBeenCalledWith({
      marketTableId: 'tbl-1',
      fleaMarketId: 'mkt-1',
      bookingDate: '2026-12-01',
      message: 'Hej',
    })
    expect(result).toEqual({ bookingId: 'b-42', clientSecret: 'pi_sec' })
  })

  it('propagates the free-booking response (no clientSecret)', async () => {
    const bookingCreate = vi.fn().mockResolvedValue({ bookingId: 'b-free' })
    const api = makeApi({ endpoints: { bookingCreate } as unknown as Api['endpoints'] })
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
  it('invokes stripe-payment-capture with the booking id', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const api = makeApi({ edge: { invoke } as unknown as Api['edge'] })
    const svc = createBookingService({ api })

    await svc.capture('booking-123')

    expect(invoke).toHaveBeenCalledWith('stripe-payment-capture', { bookingId: 'booking-123' })
  })
})

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe('BookingService.cancel', () => {
  it('invokes stripe-payment-cancel with newStatus=denied', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const api = makeApi({ edge: { invoke } as unknown as Api['edge'] })
    const svc = createBookingService({ api })

    await svc.cancel('booking-456', 'denied')

    expect(invoke).toHaveBeenCalledWith('stripe-payment-cancel', {
      bookingId: 'booking-456',
      newStatus: 'denied',
    })
  })

  it('invokes stripe-payment-cancel with newStatus=cancelled', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const api = makeApi({ edge: { invoke } as unknown as Api['edge'] })
    const svc = createBookingService({ api })

    await svc.cancel('booking-789', 'cancelled')

    expect(invoke).toHaveBeenCalledWith('stripe-payment-cancel', {
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
