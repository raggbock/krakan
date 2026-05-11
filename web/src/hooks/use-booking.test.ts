import { renderHook, act, waitFor } from '@testing-library/react'
import { useBooking } from './use-booking'
import { isAppError } from '@fyndstigen/shared'
import type { Deps, BookingProgress } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import React from 'react'

// Mock PostHog
const mockCapture = vi.fn()
vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockCapture }),
}))

// Mock Stripe hooks
const mockConfirmCardPayment = vi.fn().mockResolvedValue({ error: null })
const mockGetElement = vi.fn().mockReturnValue({})

vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => ({ confirmCardPayment: mockConfirmCardPayment }),
  useElements: () => ({ getElement: mockGetElement }),
  CardElement: 'card-element',
}))

// ---------------------------------------------------------------------------
// Scripted async generator helpers
// ---------------------------------------------------------------------------

/** Build an async generator that yields a fixed sequence of BookingProgress events. */
async function* makeStream(events: BookingProgress[]): AsyncIterable<BookingProgress> {
  for (const e of events) yield e
}

// vi.hoisted() so the mock reference is available inside vi.mock() factory
const { mockBook } = vi.hoisted(() => ({
  mockBook: vi.fn(),
}))

// Mock the entire bookingService module. `book` is replaced with mockBook so
// individual tests can script the event sequence via makeStream().
vi.mock('@/lib/booking-service', async () => {
  const { createBookingService } = await import('@fyndstigen/shared')
  const mockedApi = {
    endpoints: { 'booking.create': { invoke: vi.fn().mockResolvedValue({ bookingId: 'b-1' }) } },
    edge: { invoke: vi.fn().mockResolvedValue({}) },
  }
  const base = createBookingService({ api: mockedApi as never })
  return {
    bookingService: {
      ...base,
      book: (...args: Parameters<typeof base.book>) => mockBook(...args),
    },
  }
})

// Booking adapter under test
const mockAvailableDates = vi.fn().mockResolvedValue([] as string[])
const testDeps: Deps = (() => {
  const base = makeInMemoryDeps()
  return {
    ...base,
    bookings: { ...base.bookings, availableDates: mockAvailableDates },
  }
})()

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(DepsProvider, { deps: testDeps }, children)

vi.mock(import('@fyndstigen/shared'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

import type { OpeningHoursContext } from '@fyndstigen/shared'
import { appError } from '@fyndstigen/shared'

// Saturday-only market (dayOfWeek: 6)
const saturdayOnlyHours: OpeningHoursContext = {
  rules: [
    {
      id: 'r1',
      type: 'weekly' as const,
      dayOfWeek: 6,
      anchorDate: null,
      openTime: '09:00',
      closeTime: '15:00',
    },
  ],
  exceptions: [],
}

const mockTable = {
  id: 'table-1',
  fleaMarketId: 'market-1',
  label: 'Bord A1',
  description: null,
  priceSek: 200,
  sizeDescription: '2x1m',
  isAvailable: true,
  maxPerDay: 1,
  sortOrder: 0,
}

const mockFreeTable = {
  ...mockTable,
  id: 'table-free',
  label: 'Gratisbord B1',
  priceSek: 0,
}

/** Default happy-path stream for a paid booking. */
function paidSuccessStream(bookingId = 'booking-1'): AsyncIterable<BookingProgress> {
  return makeStream([
    { type: 'submitted', input: {} as never },
    { type: 'created', bookingId, requiresPayment: true, amountOre: 22400 },
    { type: 'payment-required', bookingId, clientSecret: 'pi_test_secret', amountOre: 22400 },
    { type: 'payment-confirmed', bookingId, amountOre: 22400 },
    { type: 'succeeded', bookingId, requiresPayment: true },
  ])
}

/** Default happy-path stream for a free booking. */
function freeSuccessStream(bookingId = 'booking-free'): AsyncIterable<BookingProgress> {
  return makeStream([
    { type: 'submitted', input: {} as never },
    { type: 'created', bookingId, requiresPayment: false, amountOre: 0 },
    { type: 'succeeded', bookingId, requiresPayment: false },
  ])
}

describe('useBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockAvailableDates).mockResolvedValue([])
    // Default: paid booking success
    mockBook.mockImplementation(() => paidSuccessStream())
  })

  it('starts with empty state', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    expect(result.current.selectedTable).toBeNull()
    expect(result.current.date).toBe('')
    expect(result.current.canSubmit).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isDone).toBe(false)
  })

  it('canSubmit is false without table', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.setDate('2026-05-01') })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false without date', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false without userId', () => {
    const { result } = renderHook(() => useBooking('market-1', undefined), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is true when table + valid date + userId', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    // Wait for availableDates fetch
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
  })

  it('validationError shows error for past dates', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.setDate('2020-01-01') })

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.validationError).toContain('förflutna')
  })

  it('validationError shows error for booked dates', async () => {
    vi.mocked(mockAvailableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.validationError).toContain('bokat')
  })

  it('computes commission and totalPrice', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })

    // 200 * 0.12 = 24
    expect(result.current.commission).toBe(24)
    expect(result.current.totalPrice).toBe(224)
  })

  it('fetches booked dates when table changes', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })

    await waitFor(() => {
      expect(mockAvailableDates).toHaveBeenCalledWith('table-1')
    })
  })

  it('submit sets isDone on success (paid booking)', async () => {
    mockBook.mockImplementation(() => paidSuccessStream())

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.isDone).toBe(true)
    expect(result.current.selectedTable).toBeNull()
  })

  it('submit passes correct params to bookingService.book', async () => {
    mockBook.mockImplementation(() => paidSuccessStream())

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockBook).toHaveBeenCalledWith(
      expect.objectContaining({
        marketTableId: 'table-1',
        fleaMarketId: 'market-1',
        bookingDate: '2026-12-01',
      }),
      expect.objectContaining({ payment: expect.anything() }),
    )
  })

  it('submit sets error on failure (failed event)', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'created', bookingId: 'b-1', requiresPayment: true, amountOre: 22400 },
      { type: 'payment-required', bookingId: 'b-1', clientSecret: 'pi_fail', amountOre: 22400 },
      { type: 'failed', stage: 'payment', error: appError('stripe.card_declined') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(isAppError(result.current.submitError)).toBe(true)
    expect(result.current.submitError?.code).toBe('stripe.card_declined')
    expect(result.current.isDone).toBe(false)
  })

  it('submit sets error when create fails', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'create', error: appError('unknown') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(isAppError(result.current.submitError)).toBe(true)
    expect(result.current.isDone).toBe(false)
  })

  it('isFree is true for free table', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockFreeTable) })

    expect(result.current.isFree).toBe(true)
    expect(result.current.commission).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })

  it('isFree is false for paid table', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })

    expect(result.current.isFree).toBe(false)
  })

  it('submit skips Stripe for free table', async () => {
    mockBook.mockImplementation(() => freeSuccessStream())

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockFreeTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.isDone).toBe(true)
    // Stripe's confirmCardPayment must NOT be called for free bookings
    expect(mockConfirmCardPayment).not.toHaveBeenCalled()
  })

  it('switching from paid to free table updates pricing', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    expect(result.current.isFree).toBe(false)
    expect(result.current.totalPrice).toBe(224)

    act(() => { result.current.selectTable(mockFreeTable) })
    expect(result.current.isFree).toBe(true)
    expect(result.current.commission).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
      result.current.setMessage('Hej')
    })

    act(() => { result.current.reset() })

    expect(result.current.selectedTable).toBeNull()
    expect(result.current.date).toBe('')
    expect(result.current.message).toBe('')
    expect(result.current.isDone).toBe(false)
  })

  // ── New computed-property tests ─────────────────────────────────────────

  it('validationError is null when no date is set (no conflict)', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })
    expect(result.current.validationError).toBeNull()
  })

  it('validationError is null for a date not in bookedDates', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.validationError).toBeNull()
  })

  it('validationError contains "bokat" when selected date is already booked', async () => {
    vi.mocked(mockAvailableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.validationError).toContain('bokat')
  })

  it('validationError clears after changing to an unbooked date', async () => {
    vi.mocked(mockAvailableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })
    expect(result.current.validationError).toContain('bokat')

    act(() => { result.current.setDate('2026-12-15') })
    expect(result.current.validationError).toBeNull()
  })

  it('validationError is null when no date is set', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })
    expect(result.current.validationError).toBeNull()
  })

  it('validationError is null for a valid future date', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.validationError).toBeNull()
  })

  it('validationError contains Swedish message for past date', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.setDate('2020-01-01') })

    expect(result.current.validationError).toBeTruthy()
    expect(result.current.validationError).toContain('förflutna')
  })

  it('validationError contains Swedish message for already-booked date', async () => {
    vi.mocked(mockAvailableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.validationError).toBeTruthy()
    expect(result.current.validationError).toContain('bokat')
  })

  it('canSubmit is false when date is already booked', async () => {
    vi.mocked(mockAvailableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false when date is in the past', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2020-01-01')
    })

    expect(result.current.canSubmit).toBe(false)
  })

  it('commission and totalPrice update when table changes', () => {
    const expensiveTable = { ...mockTable, id: 'table-2', priceSek: 500 }
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    // 200 * 0.12 = 24 commission, total 224
    expect(result.current.commission).toBe(24)
    expect(result.current.totalPrice).toBe(224)

    act(() => { result.current.selectTable(expensiveTable) })
    // 500 * 0.12 = 60 commission, total 560
    expect(result.current.commission).toBe(60)
    expect(result.current.totalPrice).toBe(560)
  })

  it('submitError is an AppError, not a plain string', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'create', error: appError('unknown') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(isAppError(result.current.submitError)).toBe(true)
    expect(typeof result.current.submitError).not.toBe('string')
    expect(result.current.submitError).toHaveProperty('code')
  })

  it('submitError is null initially', () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })
    expect(result.current.submitError).toBeNull()
  })

  // ── Opening hours context ───────────────────────────────────────────────

  it('canSubmit is false when selected date is a closed day (opening hours context)', () => {
    // 2026-12-01 is a Tuesday — closed in a Saturday-only market
    const { result } = renderHook(
      () => useBooking('market-1', 'Loppis A', 'user-1', saturdayOnlyHours),
      { wrapper },
    )

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01') // Tuesday
    })

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.validationError).toBeTruthy()
  })

  it('validationError surfaces market-closed message on a closed day', () => {
    // 2026-12-01 is a Tuesday — closed in a Saturday-only market
    const { result } = renderHook(
      () => useBooking('market-1', 'Loppis A', 'user-1', saturdayOnlyHours),
      { wrapper },
    )

    act(() => {
      result.current.setDate('2026-12-01') // Tuesday
    })

    expect(result.current.validationError).toBeTruthy()
    expect(result.current.validationError).toContain('stängd')
  })

  it('canSubmit is true on an open day with opening hours context', async () => {
    // 2026-12-05 is a Saturday — open in a Saturday-only market
    const { result } = renderHook(
      () => useBooking('market-1', 'Loppis A', 'user-1', saturdayOnlyHours),
      { wrapper },
    )

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-05') // Saturday
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
  })

  // ── Telemetry assertions ────────────────────────────────────────────────

  it('fires booking_submitted telemetry on submit', async () => {
    mockBook.mockImplementation(() => paidSuccessStream())

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockCapture).toHaveBeenCalledWith('booking_submitted', expect.objectContaining({
      market_id: 'market-1',
      is_free: false,
    }))
  })

  it('fires booking_payment_completed telemetry after payment-confirmed event', async () => {
    mockBook.mockImplementation(() => paidSuccessStream('b-paid-1'))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockCapture).toHaveBeenCalledWith('booking_payment_completed', expect.objectContaining({
      booking_id: 'b-paid-1',
      market_id: 'market-1',
      amount_ore: 22400,
    }))
  })

  it('fires booking_succeeded telemetry on succeeded event', async () => {
    mockBook.mockImplementation(() => paidSuccessStream('b-ok'))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockCapture).toHaveBeenCalledWith('booking_succeeded', expect.objectContaining({
      booking_id: 'b-ok',
      market_id: 'market-1',
      requires_payment: true,
    }))
  })

  it('fires booking_failed telemetry on failed event', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'payment', error: appError('stripe.card_declined') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockCapture).toHaveBeenCalledWith('booking_failed', expect.objectContaining({
      market_id: 'market-1',
      stage: 'payment',
      reason: 'stripe.card_declined',
    }))
  })

  it('fires telemetry in correct order for paid booking', async () => {
    mockBook.mockImplementation(() => paidSuccessStream('b-ordered'))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    const calls = mockCapture.mock.calls.map(([name]: [string]) => name)
    expect(calls).toEqual(['booking_submitted', 'booking_payment_completed', 'booking_succeeded'])
  })

  it('does NOT fire booking_payment_completed for free booking', async () => {
    mockBook.mockImplementation(() => freeSuccessStream())

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockFreeTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    const calls = mockCapture.mock.calls.map(([name]: [string]) => name)
    expect(calls).not.toContain('booking_payment_completed')
    expect(calls).toContain('booking_succeeded')
  })

  // ── isSubmitting / canSubmit timing ────────────────────────────────────

  it('isSubmitting is true during stream consumption', async () => {
    let resolveStream!: () => void
    mockBook.mockImplementation(() => {
      return (async function* () {
        yield { type: 'submitted', input: {} } as BookingProgress
        // Pause until test resolves
        await new Promise<void>((r) => { resolveStream = r })
        yield { type: 'succeeded', bookingId: 'b-1', requiresPayment: false } as BookingProgress
      })()
    })

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    let submitDone = false
    result.current.submit().then(() => { submitDone = true })

    await waitFor(() => expect(result.current.isSubmitting).toBe(true))

    await act(async () => {
      resolveStream()
      await Promise.resolve()
    })

    await waitFor(() => expect(submitDone).toBe(true))
    expect(result.current.isSubmitting).toBe(false)
  })

  it('canSubmit is false while submitting', async () => {
    let resolveStream!: () => void
    mockBook.mockImplementation(() => {
      return (async function* () {
        yield { type: 'submitted', input: {} } as BookingProgress
        await new Promise<void>((r) => { resolveStream = r })
        yield { type: 'succeeded', bookingId: 'b-1', requiresPayment: false } as BookingProgress
      })()
    })

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    result.current.submit()

    await waitFor(() => expect(result.current.canSubmit).toBe(false))

    await act(async () => {
      resolveStream()
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('clears previous error on new submit attempt', async () => {
    mockBook.mockImplementationOnce(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'create', error: appError('unknown') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })
    expect(result.current.submitError).toBeTruthy()

    // Second attempt succeeds
    mockBook.mockImplementationOnce(() => paidSuccessStream())

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-02')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBeNull()
    expect(result.current.isDone).toBe(true)
  })

  it('different table prices produce different commissions', () => {
    const { result: r1 } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })
    const { result: r2 } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })

    act(() => { r1.current.selectTable({ ...mockTable, priceSek: 100 }) })
    act(() => { r2.current.selectTable({ ...mockTable, priceSek: 500 }) })

    expect(r1.current.commission).toBe(12)
    expect(r1.current.totalPrice).toBe(112)
    expect(r2.current.commission).toBe(60)
    expect(r2.current.totalPrice).toBe(560)
  })

  it('changing table recalculates prices', () => {
    const { result } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })

    act(() => { result.current.selectTable({ ...mockTable, priceSek: 100 }) })
    expect(result.current.totalPrice).toBe(112)

    act(() => { result.current.selectTable({ ...mockTable, priceSek: 300 }) })
    expect(result.current.totalPrice).toBe(336)
  })

  it('deselecting table zeros out prices', () => {
    const { result } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })

    act(() => { result.current.selectTable(mockTable) })
    expect(result.current.totalPrice).toBe(224)

    act(() => { result.current.selectTable(null) })
    expect(result.current.commission).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })
})
