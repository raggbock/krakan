import { renderHook, act, waitFor } from '@testing-library/react'
import { useBooking } from './use-booking'
import { isAppError } from '@fyndstigen/shared'
import type { Deps, BookingProgress } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import React from 'react'
import { appError } from '@fyndstigen/shared'

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}))

const mockConfirmCardPayment = vi.fn().mockResolvedValue({ error: null })
const mockGetElement = vi.fn().mockReturnValue({})

vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => ({ confirmCardPayment: mockConfirmCardPayment }),
  useElements: () => ({ getElement: mockGetElement }),
  CardElement: 'card-element',
}))

const mockAvailableDates = vi.fn().mockResolvedValue([] as string[])

// vi.hoisted() runs before vi.mock() hoisting so the reference is safe.
const { mockBook } = vi.hoisted(() => ({ mockBook: vi.fn() }))

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

const testDeps: Deps = (() => {
  const base = makeInMemoryDeps()
  return {
    ...base,
    bookings: { ...base.bookings, availableDates: mockAvailableDates },
  }
})()
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(DepsProvider, { deps: testDeps }, children)

vi.mock('@fyndstigen/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fyndstigen/shared')
  return actual
})

async function* makeStream(events: BookingProgress[]): AsyncIterable<BookingProgress> {
  for (const e of events) yield e
}

const mockTable = {
  id: 'table-1',
  flea_market_id: 'market-1',
  label: 'Bord A1',
  description: null,
  price_sek: 200,
  size_description: '2x1m',
  is_available: true,
  max_per_day: 1,
  sort_order: 0,
  created_at: '',
  updated_at: '',
}

describe('useBooking — payment edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockAvailableDates).mockResolvedValue([])
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'created', bookingId: 'booking-1', requiresPayment: true, amountOre: 22400 },
      { type: 'payment-required', bookingId: 'booking-1', clientSecret: 'pi_test_secret', amountOre: 22400 },
      { type: 'payment-confirmed', bookingId: 'booking-1', amountOre: 22400 },
      { type: 'succeeded', bookingId: 'booking-1', requiresPayment: true },
    ]))
  })

  it('submit succeeds when service emits succeeded', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => { await result.current.submit() })
    expect(result.current.isDone).toBe(true)
  })

  it('handles payment failure (failed stage: payment)', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'created', bookingId: 'b-1', requiresPayment: true, amountOre: 22400 },
      { type: 'payment-required', bookingId: 'b-1', clientSecret: 'pi_fail', amountOre: 22400 },
      { type: 'failed', stage: 'payment', error: appError('unknown') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(isAppError(result.current.submitError)).toBe(true)
    expect(result.current.submitError?.code).toBe('unknown')
    expect(result.current.isDone).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
  })

  it('handles network error during payment intent creation', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'create', error: appError('stripe.network_error') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(isAppError(result.current.submitError)).toBe(true)
    expect(result.current.submitError?.code).toBe('stripe.network_error')
    expect(result.current.isDone).toBe(false)
  })

  it('handles edge function returning error', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'create', error: appError('booking.duplicate') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBeTruthy()
    expect(result.current.isDone).toBe(false)
  })

  it('handles organizer not having Stripe setup', async () => {
    mockBook.mockImplementation(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'failed', stage: 'create', error: appError('booking.stripe_not_setup') },
    ]))

    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBeTruthy()
    expect(result.current.isDone).toBe(false)
  })

  it('passes correct body to bookingService.book', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-25')
      result.current.setMessage('Säljer vinterkläder')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockBook).toHaveBeenCalledWith(
      expect.objectContaining({
        marketTableId: 'table-1',
        fleaMarketId: 'market-1',
        bookingDate: '2026-12-25',
        message: 'Säljer vinterkläder',
      }),
      expect.anything(),
    )
  })

  it('passes undefined message when empty', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'Loppis A', 'user-1'), { wrapper })

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-25')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockBook).toHaveBeenCalledWith(
      expect.objectContaining({ message: undefined }),
      expect.anything(),
    )
  })

  it('does not confirm card if service emits failed at create stage', async () => {
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

    // Stripe hook must not be called — the service handles payment
    expect(mockConfirmCardPayment).not.toHaveBeenCalled()
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
    mockBook.mockImplementationOnce(() => makeStream([
      { type: 'submitted', input: {} as never },
      { type: 'created', bookingId: 'b-2', requiresPayment: true, amountOre: 22400 },
      { type: 'payment-required', bookingId: 'b-2', clientSecret: 'pi_retry', amountOre: 22400 },
      { type: 'payment-confirmed', bookingId: 'b-2', amountOre: 22400 },
      { type: 'succeeded', bookingId: 'b-2', requiresPayment: true },
    ]))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-02')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBeNull()
    expect(result.current.isDone).toBe(true)
  })

  it('isSubmitting is true during stream processing', async () => {
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

  it('different table prices produce different commissions', () => {
    const { result: r1 } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })
    const { result: r2 } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })

    act(() => { r1.current.selectTable({ ...mockTable, price_sek: 100 }) })
    act(() => { r2.current.selectTable({ ...mockTable, price_sek: 500 }) })

    expect(r1.current.commission).toBe(12)
    expect(r1.current.totalPrice).toBe(112)
    expect(r2.current.commission).toBe(60)
    expect(r2.current.totalPrice).toBe(560)
  })

  it('changing table recalculates prices', () => {
    const { result } = renderHook(() => useBooking('m-1', 'u-1'), { wrapper })

    act(() => { result.current.selectTable({ ...mockTable, price_sek: 100 }) })
    expect(result.current.totalPrice).toBe(112)

    act(() => { result.current.selectTable({ ...mockTable, price_sek: 300 }) })
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
