import { renderHook, waitFor } from '@testing-library/react'
import { useOrganizerStats } from './use-organizer-stats'

vi.mock('@/lib/api', () => ({
  api: {
    fleaMarkets: {
      listByOrganizer: vi.fn(),
    },
    edge: {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
    rpc: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockMarket1 = { id: 'market-1', name: 'Loppis Centrum', organizer_id: 'org-1' }
const mockMarket2 = { id: 'market-2', name: 'Loppis Hamnen', organizer_id: 'org-1' }

function setupDefaults() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'test-token' } },
  } as any)
  vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([])
  // Default: RPC returns empty
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
  vi.mocked(api.edge.invoke).mockResolvedValue({ markets: [] } as any)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useOrganizerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useOrganizerStats('org-1'))
    expect(result.current.loading).toBe(true)
  })

  it('returns empty markets when organizer has no markets', async () => {
    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('aggregates booking stats correctly across two markets', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1, mockMarket2] as any)

    // RPC returns pre-aggregated rows (one row per market+status)
    const bookingRows = [
      { flea_market_id: 'market-1', status: 'pending', booking_count: 1, revenue_sek: 0 },
      { flea_market_id: 'market-1', status: 'confirmed', booking_count: 2, revenue_sek: 352 },
      { flea_market_id: 'market-1', status: 'denied', booking_count: 1, revenue_sek: 0 },
      { flea_market_id: 'market-2', status: 'confirmed', booking_count: 1, revenue_sek: 132 },
      { flea_market_id: 'market-2', status: 'cancelled', booking_count: 1, revenue_sek: 0 },
    ]

    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'organizer_booking_stats') return Promise.resolve({ data: bookingRows, error: null }) as any
      return Promise.resolve({ data: [], error: null }) as any
    })

    const { result } = renderHook(() => useOrganizerStats('org-1'))
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

  it('calculates revenue correctly from RPC results', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === 'organizer_booking_stats') {
        return Promise.resolve({
          data: [{ flea_market_id: 'market-1', status: 'confirmed', booking_count: 2, revenue_sek: 528 }],
          error: null,
        }) as any
      }
      return Promise.resolve({ data: [], error: null }) as any
    })

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets[0].revenue_total_sek).toBe(528)
    expect(result.current.totals.revenue_total_sek).toBe(528)
  })

  it('calculates conversion_30d as round(initiated/pageviews * 100)', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(api.edge.invoke).mockResolvedValue({
      markets: [{
        flea_market_id: 'market-1', name: 'Loppis Centrum',
        pageviews_30d: 200, pageviews_total: 500, bookings_initiated_30d: 50,
      }],
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets[0].conversion_30d).toBe(25)
    expect(result.current.totals.conversion_30d).toBe(25)
  })

  it('returns conversion_30d of 0 when pageviews_30d is 0', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(api.edge.invoke).mockResolvedValue({
      markets: [{
        flea_market_id: 'market-1', name: 'Loppis Centrum',
        pageviews_30d: 0, pageviews_total: 0, bookings_initiated_30d: 0,
      }],
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets[0].conversion_30d).toBe(0)
  })

  it('handles PostHog edge function failure gracefully', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(api.edge.invoke).mockRejectedValue(new Error('edge function unavailable'))

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.markets[0].pageviews_30d).toBe(0)
  })

  it('returns error message on auth failure', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Du måste vara inloggad')
    expect(result.current.markets).toEqual([])
  })

  it('does not fetch when organizerId is undefined', () => {
    const { result } = renderHook(() => useOrganizerStats(undefined))

    expect(result.current.loading).toBe(true)
    expect(api.fleaMarkets.listByOrganizer).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
