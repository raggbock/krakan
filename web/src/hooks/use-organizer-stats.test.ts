import { renderHook, waitFor } from '@testing-library/react'
import { useOrganizerStats } from './use-organizer-stats'
import type { Deps } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import React from 'react'

vi.mock('@/lib/edge', () => ({
  edge: { invoke: vi.fn() },
  endpoints: {
    'organizer.stats': { invoke: vi.fn() },
  },
}))

import { endpoints } from '@/lib/edge'

// ─── Test deps wrapper ─────────────────────────────────────────────────────

const mockListByOrganizer = vi.fn()
const mockBookingStats = vi.fn()
const mockRouteStats = vi.fn()

const testDeps: Deps = (() => {
  const base = makeInMemoryDeps()
  return {
    ...base,
    markets: { ...base.markets, listByOrganizer: mockListByOrganizer },
    stats: {
      organizerBookingStats: mockBookingStats,
      organizerRouteStats: mockRouteStats,
    },
  }
})()

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(DepsProvider, { deps: testDeps }, children)

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockMarket1 = { id: 'market-1', name: 'Loppis Centrum', organizer_id: 'org-1' }
const mockMarket2 = { id: 'market-2', name: 'Loppis Hamnen', organizer_id: 'org-1' }

function setupDefaults() {
  mockListByOrganizer.mockResolvedValue([])
  mockBookingStats.mockResolvedValue([])
  mockRouteStats.mockResolvedValue([])
  vi.mocked(endpoints['organizer.stats'].invoke).mockResolvedValue({ markets: [] } as never)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useOrganizerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    expect(result.current.loading).toBe(true)
  })

  it('returns empty markets when organizer has no markets', async () => {
    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('aggregates booking stats correctly across two markets', async () => {
    mockListByOrganizer.mockResolvedValue([mockMarket1, mockMarket2])

    // Stats port returns pre-aggregated rows (one row per market+status)
    const bookingRows = [
      { flea_market_id: 'market-1', status: 'pending', booking_count: 1, revenue_sek: 0 },
      { flea_market_id: 'market-1', status: 'confirmed', booking_count: 2, revenue_sek: 352 },
      { flea_market_id: 'market-1', status: 'denied', booking_count: 1, revenue_sek: 0 },
      { flea_market_id: 'market-2', status: 'confirmed', booking_count: 1, revenue_sek: 132 },
      { flea_market_id: 'market-2', status: 'cancelled', booking_count: 1, revenue_sek: 0 },
    ]
    mockBookingStats.mockResolvedValue(bookingRows)

    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const m1 = result.current.markets.find((m) => m.flea_market_id === 'market-1')!
    expect(m1.bookings_total.pending).toBe(1)
    expect(m1.bookings_total.confirmed).toBe(2)
    expect(m1.bookings_total.denied).toBe(1)

    const m2 = result.current.markets.find((m) => m.flea_market_id === 'market-2')!
    expect(m2.bookings_total.confirmed).toBe(1)
    expect(m2.bookings_total.cancelled).toBe(1)

    // totals: confirmed + pending = (2+1) + (1) = 4
    expect(result.current.totals.bookings_total).toBe(4)
  })

  it('calculates revenue correctly from stats port', async () => {
    mockListByOrganizer.mockResolvedValue([mockMarket1])
    mockBookingStats.mockResolvedValue([
      { flea_market_id: 'market-1', status: 'confirmed', booking_count: 2, revenue_sek: 528 },
    ])

    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets[0].revenue_total_sek).toBe(528)
    expect(result.current.totals.revenue_total_sek).toBe(528)
  })

  it('calculates conversion_30d as round(initiated/pageviews * 100)', async () => {
    mockListByOrganizer.mockResolvedValue([mockMarket1])
    vi.mocked(endpoints['organizer.stats'].invoke).mockResolvedValue({
      markets: [{
        flea_market_id: 'market-1', name: 'Loppis Centrum',
        pageviews_30d: 200, pageviews_total: 500, bookings_initiated_30d: 50,
      }],
    } as never)

    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets[0].conversion_30d).toBe(25)
    expect(result.current.totals.conversion_30d).toBe(25)
  })

  it('returns conversion_30d of 0 when pageviews_30d is 0', async () => {
    mockListByOrganizer.mockResolvedValue([mockMarket1])
    vi.mocked(endpoints['organizer.stats'].invoke).mockResolvedValue({
      markets: [{
        flea_market_id: 'market-1', name: 'Loppis Centrum',
        pageviews_30d: 0, pageviews_total: 0, bookings_initiated_30d: 0,
      }],
    } as never)

    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets[0].conversion_30d).toBe(0)
  })

  it('handles PostHog edge function failure gracefully', async () => {
    mockListByOrganizer.mockResolvedValue([mockMarket1])
    vi.mocked(endpoints['organizer.stats'].invoke).mockRejectedValue(new Error('edge function unavailable'))

    const { result } = renderHook(() => useOrganizerStats('org-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.markets[0].pageviews_30d).toBe(0)
  })

  it('does not fetch when organizerId is undefined', () => {
    const { result } = renderHook(() => useOrganizerStats(undefined), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(mockListByOrganizer).not.toHaveBeenCalled()
    expect(mockBookingStats).not.toHaveBeenCalled()
  })
})
