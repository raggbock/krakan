import { renderHook, act, waitFor } from '@testing-library/react'
import { useBooking } from './use-booking'

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

const mockInvoke = vi.fn()
vi.mock('@/lib/api', () => ({
  api: {
    bookings: {
      availableDates: vi.fn().mockResolvedValue([]),
    },
    endpoints: {
      bookingCreate: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}))

vi.mock('@fyndstigen/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fyndstigen/shared')
  return actual
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

describe('useBooking — payment edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.bookings.availableDates).mockResolvedValue([])
    mockConfirmCardPayment.mockResolvedValue({ error: null })
    mockInvoke.mockResolvedValue({ clientSecret: 'pi_test_secret', bookingId: 'booking-1' })
  })

  it('does not submit without Stripe (stripe hooks return null equivalent)', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => { await result.current.submit() })
    expect(result.current.isDone).toBe(true)
  })

  it('handles 3DS authentication error', async () => {
    mockConfirmCardPayment.mockResolvedValue({
      error: { type: 'card_error', message: 'Your card was declined. Please try a different card.' },
    })

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBe('Your card was declined. Please try a different card.')
    expect(result.current.isDone).toBe(false)
    expect(result.current.isSubmitting).toBe(false)
  })

  it('handles network error during payment intent creation', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBe('Network request failed')
    expect(result.current.isDone).toBe(false)
  })

  it('handles edge function returning error', async () => {
    mockInvoke.mockRejectedValue(new Error('Du har redan en pågående bokning för detta bord och datum'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

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
    mockInvoke.mockRejectedValue(new Error('Organizer has not completed Stripe setup'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBeTruthy()
    expect(result.current.isDone).toBe(false)
  })

  it('passes correct body to edge function', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-25')
      result.current.setMessage('Säljer vinterkläder')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockInvoke).toHaveBeenCalledWith({
      marketTableId: 'table-1',
      fleaMarketId: 'market-1',
      bookingDate: '2026-12-25',
      message: 'Säljer vinterkläder',
    })
  })

  it('passes undefined message when empty', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-25')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockInvoke).toHaveBeenCalledWith(expect.objectContaining({
      message: undefined,
    }))
  })

  it('confirms card payment with correct client secret', async () => {
    mockInvoke.mockResolvedValue({ clientSecret: 'pi_specific_secret_123', bookingId: 'b-99' })

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockConfirmCardPayment).toHaveBeenCalledWith('pi_specific_secret_123', {
      payment_method: { card: {} },
    })
  })

  it('does not confirm card if edge function fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(mockConfirmCardPayment).not.toHaveBeenCalled()
  })

  it('clears previous error on new submit attempt', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Temporary error'))

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })
    expect(result.current.submitError).toBeTruthy()

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-02')
    })

    mockInvoke.mockResolvedValueOnce({ clientSecret: 'pi_retry', bookingId: 'b-2' })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(async () => { await result.current.submit() })

    expect(result.current.submitError).toBeNull()
    expect(result.current.isDone).toBe(true)
  })

  it('isSubmitting is true during payment processing', async () => {
    let resolveInvoke!: (value: unknown) => void
    mockInvoke.mockImplementation(
      () => new Promise((r) => { resolveInvoke = r }),
    )

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    let submitDone = false
    result.current.submit().then(() => { submitDone = true })

    await waitFor(() => expect(result.current.isSubmitting).toBe(true))

    await act(async () => {
      resolveInvoke({ clientSecret: 'pi_test', bookingId: 'b-1' })
      await Promise.resolve()
    })

    await waitFor(() => expect(submitDone).toBe(true))
    expect(result.current.isSubmitting).toBe(false)
  })

  it('canSubmit is false while submitting', async () => {
    let resolveInvoke!: (value: unknown) => void
    mockInvoke.mockImplementation(
      () => new Promise((r) => { resolveInvoke = r }),
    )

    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    result.current.submit()

    await waitFor(() => expect(result.current.canSubmit).toBe(false))

    await act(async () => {
      resolveInvoke({ clientSecret: 'pi_test', bookingId: 'b-1' })
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('different table prices produce different commissions', () => {
    const { result: r1 } = renderHook(() => useBooking('m-1', 'u-1'))
    const { result: r2 } = renderHook(() => useBooking('m-1', 'u-1'))

    act(() => { r1.current.selectTable({ ...mockTable, price_sek: 100 }) })
    act(() => { r2.current.selectTable({ ...mockTable, price_sek: 500 }) })

    expect(r1.current.commission).toBe(12)
    expect(r1.current.totalPrice).toBe(112)
    expect(r2.current.commission).toBe(60)
    expect(r2.current.totalPrice).toBe(560)
  })

  it('changing table recalculates prices', () => {
    const { result } = renderHook(() => useBooking('m-1', 'u-1'))

    act(() => { result.current.selectTable({ ...mockTable, price_sek: 100 }) })
    expect(result.current.totalPrice).toBe(112)

    act(() => { result.current.selectTable({ ...mockTable, price_sek: 300 }) })
    expect(result.current.totalPrice).toBe(336)
  })

  it('deselecting table zeros out prices', () => {
    const { result } = renderHook(() => useBooking('m-1', 'u-1'))

    act(() => { result.current.selectTable(mockTable) })
    expect(result.current.totalPrice).toBe(224)

    act(() => { result.current.selectTable(null) })
    expect(result.current.commission).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })
})
