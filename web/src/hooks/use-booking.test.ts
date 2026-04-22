import { renderHook, act, waitFor } from '@testing-library/react'
import { useBooking } from './use-booking'
import { isAppError } from '@fyndstigen/shared'

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

// Mock the api module (bookings, edge, and bookingService facade)
vi.mock('@/lib/api', async (importOriginal) => {
  const { createBookingService } = await import('@fyndstigen/shared')
  const mockedApi = {
    bookings: {
      availableDates: vi.fn().mockResolvedValue([]),
    },
    endpoints: {
      bookingCreate: vi.fn().mockResolvedValue({ clientSecret: 'pi_test_secret', bookingId: 'booking-1' }),
    },
    edge: {
      invoke: vi.fn().mockResolvedValue({}),
    },
  }
  return {
    api: mockedApi,
    bookingService: createBookingService({ api: mockedApi as never }),
  }
})

// Mock shared imports
vi.mock(import('@fyndstigen/shared'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

import { api } from '@/lib/api'

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

const mockFreeTable = {
  ...mockTable,
  id: 'table-free',
  label: 'Gratisbord B1',
  price_sek: 0,
}

describe('useBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.bookings.availableDates).mockResolvedValue([])
    mockConfirmCardPayment.mockResolvedValue({ error: null })
    vi.mocked(api.endpoints.bookingCreate).mockResolvedValue({ clientSecret: 'pi_test_secret', bookingId: 'booking-1' })
  })

  it('starts with empty state', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    expect(result.current.selectedTable).toBeNull()
    expect(result.current.date).toBe('')
    expect(result.current.canSubmit).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isDone).toBe(false)
  })

  it('canSubmit is false without table', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.setDate('2026-05-01') })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false without date', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false without userId', () => {
    const { result } = renderHook(() => useBooking('market-1', undefined))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is true when table + valid date + userId', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    // Wait for availableDates fetch
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
  })

  it('dateValidation shows error for past dates', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.setDate('2020-01-01') })

    expect(result.current.dateValidation.valid).toBe(false)
    expect(result.current.dateValidation.error).toContain('förflutna')
  })

  it('dateValidation shows error for booked dates', async () => {
    vi.mocked(api.bookings.availableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.dateValidation.valid).toBe(false)
    expect(result.current.dateValidation.error).toContain('bokat')
  })

  it('computes commission and totalPrice', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })

    // 200 * 0.12 = 24
    expect(result.current.commission).toBe(24)
    expect(result.current.totalPrice).toBe(224)
  })

  it('fetches booked dates when table changes', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })

    await waitFor(() => {
      expect(api.bookings.availableDates).toHaveBeenCalledWith('table-1')
    })
  })

  it('submit creates payment intent and confirms card', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    // Verify edge function was called
    expect(api.endpoints.bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      marketTableId: 'table-1',
      fleaMarketId: 'market-1',
      bookingDate: '2026-12-01',
    }))

    // Verify Stripe card confirmation
    expect(mockConfirmCardPayment).toHaveBeenCalledWith('pi_test_secret', {
      payment_method: { card: {} },
    })

    expect(result.current.isDone).toBe(true)
    expect(result.current.selectedTable).toBeNull()
  })

  it('submit sets error on payment failure', async () => {
    mockConfirmCardPayment.mockResolvedValue({
      error: { message: 'Card declined' },
    })

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(isAppError(result.current.submitError)).toBe(true)
    expect(result.current.submitError?.code).toBe('unknown')
    expect(result.current.isDone).toBe(false)
  })

  it('submit sets error when edge function fails', async () => {
    vi.mocked(api.endpoints.bookingCreate).mockRejectedValue(new Error('Organizer has not completed Stripe setup'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

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
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockFreeTable) })

    expect(result.current.isFree).toBe(true)
    expect(result.current.commission).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })

  it('isFree is false for paid table', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })

    expect(result.current.isFree).toBe(false)
  })

  it('submit skips Stripe for free table', async () => {
    vi.mocked(api.endpoints.bookingCreate).mockResolvedValue({ bookingId: 'booking-free' })

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockFreeTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    // Edge function called with free table
    expect(api.endpoints.bookingCreate).toHaveBeenCalledWith(expect.objectContaining({
      marketTableId: 'table-free',
    }))

    // Stripe NOT called — no clientSecret returned
    expect(mockConfirmCardPayment).not.toHaveBeenCalled()

    expect(result.current.isDone).toBe(true)
  })

  it('switching from paid to free table updates pricing', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })
    expect(result.current.isFree).toBe(false)
    expect(result.current.totalPrice).toBe(224)

    act(() => { result.current.selectTable(mockFreeTable) })
    expect(result.current.isFree).toBe(true)
    expect(result.current.commission).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

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

  it('dateConflict is false when no date is set', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))
    expect(result.current.dateConflict).toBe(false)
  })

  it('dateConflict is false for a date not in bookedDates', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.dateConflict).toBe(false)
  })

  it('dateConflict is true when selected date is in bookedDates', async () => {
    vi.mocked(api.bookings.availableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.dateConflict).toBe(true)
  })

  it('dateConflict reverts to false after changing to unbooked date', async () => {
    vi.mocked(api.bookings.availableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })
    expect(result.current.dateConflict).toBe(true)

    act(() => { result.current.setDate('2026-12-15') })
    expect(result.current.dateConflict).toBe(false)
  })

  it('validationError is null when no date is set', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))
    expect(result.current.validationError).toBeNull()
  })

  it('validationError is null for a valid future date', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.validationError).toBeNull()
  })

  it('validationError contains Swedish message for past date', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.setDate('2020-01-01') })

    expect(result.current.validationError).toBeTruthy()
    expect(result.current.validationError).toContain('förflutna')
  })

  it('validationError contains Swedish message for already-booked date', async () => {
    vi.mocked(api.bookings.availableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.validationError).toBeTruthy()
    expect(result.current.validationError).toContain('bokat')
  })

  it('canSubmit is false when date is already booked', async () => {
    vi.mocked(api.bookings.availableDates).mockResolvedValue(['2026-12-01'])

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => { result.current.selectTable(mockTable) })
    await waitFor(() => expect(result.current.bookedDates).toContain('2026-12-01'))

    act(() => { result.current.setDate('2026-12-01') })

    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false when date is in the past', () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2020-01-01')
    })

    expect(result.current.canSubmit).toBe(false)
  })

  it('commission and totalPrice update when table changes', () => {
    const expensiveTable = { ...mockTable, id: 'table-2', price_sek: 500 }
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

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
    vi.mocked(api.endpoints.bookingCreate).mockRejectedValue(new Error('network failure'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

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
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))
    expect(result.current.submitError).toBeNull()
  })
})
