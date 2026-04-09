import { renderHook, act, waitFor } from '@testing-library/react'
import { useBooking } from './use-booking'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    bookings: {
      availableDates: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'booking-1' }),
    },
  },
}))

// Mock shared imports
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

describe('useBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.bookings.availableDates).mockResolvedValue([])
    vi.mocked(api.bookings.create).mockResolvedValue({ id: 'booking-1' })
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

  it('submit calls API and resets state on success', async () => {
    const { result } = renderHook(() => useBooking('market-1', 'user-1'))

    act(() => {
      result.current.selectTable(mockTable)
      result.current.setDate('2026-12-01')
    })

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => { await result.current.submit() })

    expect(api.bookings.create).toHaveBeenCalledWith(
      expect.objectContaining({
        marketTableId: 'table-1',
        fleaMarketId: 'market-1',
        bookedBy: 'user-1',
        bookingDate: '2026-12-01',
        priceSek: 200,
      }),
    )
    expect(result.current.isDone).toBe(true)
    expect(result.current.selectedTable).toBeNull()
    expect(result.current.date).toBe('')
  })

  it('submit sets error on failure', async () => {
    vi.mocked(api.bookings.create).mockRejectedValue(new Error('fail'))

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
})
