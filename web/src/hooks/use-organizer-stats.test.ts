import { renderHook, waitFor } from '@testing-library/react'
import { useOrganizerStats } from './use-organizer-stats'

vi.mock('@/lib/api', () => ({
  api: {
    fleaMarkets: {
      listByOrganizer: vi.fn(),
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
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeChainableQuery(resolvedValue: { data: unknown }) {
  const q: Record<string, unknown> = {}
  q.select = vi.fn().mockReturnValue(q)
  q.in = vi.fn().mockReturnValue(q)
  q.gte = vi.fn().mockResolvedValue(resolvedValue)
  // make the plain await (no .gte) also resolve via a thenable
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(resolve, reject)
  return q
}

const mockMarket1 = {
  id: 'market-1',
  name: 'Loppis Centrum',
  organizer_id: 'org-1',
}

const mockMarket2 = {
  id: 'market-2',
  name: 'Loppis Hamnen',
  organizer_id: 'org-1',
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useOrganizerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: auth succeeds
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    } as any)

    // Default: no markets
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([])

    // Default: empty booking / route rows
    vi.mocked(supabase.from).mockReturnValue(makeChainableQuery({ data: [] }) as any)

    // Default: PostHog edge function returns empty
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { markets: [] },
      error: null,
    } as any)
  })

  // ── 1. Loading state ────────────────────────────────────────────────────

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useOrganizerStats('org-1'))
    expect(result.current.loading).toBe(true)
  })

  // ── 2. No markets ───────────────────────────────────────────────────────

  it('returns empty markets when organizer has no markets', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([])

    const { result } = renderHook(() => useOrganizerStats('org-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.markets).toEqual([])
    expect(result.current.error).toBeNull()
  })

  // ── 3. Booking stats aggregation ────────────────────────────────────────

  it('aggregates booking stats correctly across two markets', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1, mockMarket2] as any)

    const bookingRows = [
      // market-1: 1 pending, 2 confirmed (revenue 200-24=176 each = 352), 1 denied
      { flea_market_id: 'market-1', status: 'pending',   price_sek: 200, commission_sek: 24 },
      { flea_market_id: 'market-1', status: 'confirmed', price_sek: 200, commission_sek: 24 },
      { flea_market_id: 'market-1', status: 'confirmed', price_sek: 200, commission_sek: 24 },
      { flea_market_id: 'market-1', status: 'denied',    price_sek: 200, commission_sek: 24 },
      // market-2: 1 confirmed, 1 cancelled
      { flea_market_id: 'market-2', status: 'confirmed', price_sek: 150, commission_sek: 18 },
      { flea_market_id: 'market-2', status: 'cancelled', price_sek: 150, commission_sek: 18 },
    ]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'bookings') return makeChainableQuery({ data: bookingRows }) as any
      return makeChainableQuery({ data: [] }) as any
    })

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const m1 = result.current.markets.find((m) => m.flea_market_id === 'market-1')!
    const m2 = result.current.markets.find((m) => m.flea_market_id === 'market-2')!

    // market-1 totals
    expect(m1.bookings_total.pending).toBe(1)
    expect(m1.bookings_total.confirmed).toBe(2)
    expect(m1.bookings_total.denied).toBe(1)
    expect(m1.bookings_total.cancelled).toBe(0)

    // market-2 totals
    expect(m2.bookings_total.confirmed).toBe(1)
    expect(m2.bookings_total.cancelled).toBe(1)

    // overall totals: bookings_total = confirmed + pending across all markets
    // market-1: 2 confirmed + 1 pending = 3; market-2: 1 confirmed = 1 → total = 4
    expect(result.current.totals.bookings_total).toBe(4)
  })

  // ── 4. Revenue calculation ──────────────────────────────────────────────

  it('calculates revenue correctly (price minus commission for confirmed bookings)', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    const bookingRows = [
      { flea_market_id: 'market-1', status: 'confirmed', price_sek: 300, commission_sek: 36 },
      { flea_market_id: 'market-1', status: 'confirmed', price_sek: 300, commission_sek: 36 },
      // pending should NOT contribute to revenue
      { flea_market_id: 'market-1', status: 'pending',   price_sek: 300, commission_sek: 36 },
    ]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'bookings') return makeChainableQuery({ data: bookingRows }) as any
      return makeChainableQuery({ data: [] }) as any
    })

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const m1 = result.current.markets.find((m) => m.flea_market_id === 'market-1')!
    // 2 × (300 - 36) = 528
    expect(m1.revenue_total_sek).toBe(528)
    expect(result.current.totals.revenue_total_sek).toBe(528)
  })

  // ── 5. Conversion rate ──────────────────────────────────────────────────

  it('calculates conversion_30d as round(initiated/pageviews * 100)', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        markets: [
          {
            flea_market_id: 'market-1',
            name: 'Loppis Centrum',
            pageviews_30d: 200,
            pageviews_total: 500,
            bookings_initiated_30d: 50,
          },
        ],
      },
      error: null,
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const m1 = result.current.markets.find((m) => m.flea_market_id === 'market-1')!
    // round(50/200 * 100) = round(25) = 25
    expect(m1.conversion_30d).toBe(25)

    // totals.conversion_30d: totalInitiated=50, pageviews_30d=200 → 25
    expect(result.current.totals.conversion_30d).toBe(25)
  })

  // ── 6. Zero conversion when no pageviews ────────────────────────────────

  it('returns conversion_30d of 0 when pageviews_30d is 0', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        markets: [
          {
            flea_market_id: 'market-1',
            name: 'Loppis Centrum',
            pageviews_30d: 0,
            pageviews_total: 0,
            bookings_initiated_30d: 0,
          },
        ],
      },
      error: null,
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const m1 = result.current.markets.find((m) => m.flea_market_id === 'market-1')!
    expect(m1.conversion_30d).toBe(0)
    expect(result.current.totals.conversion_30d).toBe(0)
  })

  // ── 7. PostHog edge function failure ────────────────────────────────────

  it('handles PostHog edge function failure gracefully (pageview stats default to 0)', async () => {
    vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue([mockMarket1] as any)

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new Error('edge function unavailable'),
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    const m1 = result.current.markets.find((m) => m.flea_market_id === 'market-1')!
    expect(m1.pageviews_30d).toBe(0)
    expect(m1.pageviews_total).toBe(0)
    expect(m1.bookings_initiated_30d).toBe(0)
    expect(m1.conversion_30d).toBe(0)
  })

  // ── 8. Auth failure ──────────────────────────────────────────────────────

  it('returns error message on auth failure', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as any)

    const { result } = renderHook(() => useOrganizerStats('org-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Du måste vara inloggad')
    expect(result.current.markets).toEqual([])
  })

  // ── 9. No fetch when organizerId is undefined ────────────────────────────

  it('does not fetch when organizerId is undefined', () => {
    const { result } = renderHook(() => useOrganizerStats(undefined))

    // loading stays true (effect returns early without resolving)
    expect(result.current.loading).toBe(true)
    expect(api.fleaMarkets.listByOrganizer).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
