import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider, useDeps } from '@/providers/deps-provider'
import { useMarkets, useMarketsByOrganizer } from './use-markets'
import { useMarketDetails } from './use-market-details'
import { useRoute, useRoutesByUser } from './use-routes'

const SEED_MARKET = {
  id: 'm1',
  name: 'Loppis A',
  organizer_id: 'u1',
  is_permanent: true,
  published_at: '2024-01-01T00:00:00Z',
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  street: 'Storgatan 1',
  zip_code: '12345',
  city: 'Testköping',
  country: 'SE',
  latitude: 59.3,
  longitude: 18.0,
  auto_accept_bookings: false,
} as const

const SEED_ROUTE = {
  id: 'r1',
  name: 'Rundan',
  description: null,
  created_by: 'user-1',
  start_latitude: null,
  start_longitude: null,
  planned_date: null,
  is_published: false,
  published_at: null,
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  stops: [
    { flea_market_id: 'm1', sort_order: 0 },
    { flea_market_id: 'm2', sort_order: 1 },
    { flea_market_id: 'm3', sort_order: 2 },
  ],
} as const

function createWrapper(deps = makeInMemoryDeps([SEED_MARKET], [SEED_ROUTE])) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <DepsProvider deps={deps}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DepsProvider>
  )
}

describe('useMarkets — via DepsProvider + makeInMemoryDeps', () => {
  it('returns items and count from in-memory adapter', async () => {
    const { result } = renderHook(() => useMarkets({ page: 1, pageSize: 20 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toHaveLength(1)
    expect(result.current.markets[0].name).toBe('Loppis A')
    expect(result.current.count).toBe(1)
    expect(result.current.error).toBeNull()
  })
})

describe('useMarketsByOrganizer — via DepsProvider + makeInMemoryDeps', () => {
  it('returns markets for matching organizer', async () => {
    const { result } = renderHook(() => useMarketsByOrganizer('u1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toHaveLength(1)
    expect(result.current.markets[0].id).toBe('m1')
  })

  it('returns empty list for unknown organizer', async () => {
    const { result } = renderHook(() => useMarketsByOrganizer('unknown'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toHaveLength(0)
  })

  it('skips fetch when no organizerId', async () => {
    const { result } = renderHook(() => useMarketsByOrganizer(undefined), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toEqual([]))
  })
})

describe('useMarketDetails — via DepsProvider + makeInMemoryDeps', () => {
  it('fetches market details from in-memory adapter', async () => {
    const { result } = renderHook(() => useMarketDetails('m1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.market?.name).toBe('Loppis A')
    expect(result.current.tables).toEqual([])
  })

  it('skips fetch when no id', async () => {
    const { result } = renderHook(() => useMarketDetails(undefined), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.market).toBeNull())
  })
})

describe('useRoute — via DepsProvider + makeInMemoryDeps (migrated)', () => {
  it('fetches route by id', async () => {
    const { result } = renderHook(() => useRoute('r1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.route?.name).toBe('Rundan')
  })

  it('skips when no id', async () => {
    const { result } = renderHook(() => useRoute(undefined), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.route).toBeNull())
  })
})

describe('useRoutesByUser — via DepsProvider + makeInMemoryDeps (migrated)', () => {
  it('fetches routes for user', async () => {
    const { result } = renderHook(() => useRoutesByUser('user-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.routes).toHaveLength(1)
    expect(result.current.routes[0].name).toBe('Rundan')
  })

  it('returns empty array for unknown user', async () => {
    const { result } = renderHook(() => useRoutesByUser('unknown-user'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.routes).toHaveLength(0)
  })
})

describe('DepsProvider identity', () => {
  it('useDeps() returns the SAME reference across re-renders when deps prop is stable', () => {
    const deps = makeInMemoryDeps([SEED_MARKET])
    const seen: unknown[] = []

    const { rerender } = renderHook(
      () => {
        seen.push(useDeps())
      },
      { wrapper: createWrapper(deps) },
    )

    rerender()
    rerender()

    expect(seen.length).toBeGreaterThanOrEqual(3)
    expect(seen[0]).toBe(deps)
    expect(seen[1]).toBe(deps)
    expect(seen[2]).toBe(deps)
  })
})
