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
  organizerId: 'u1',
  isPermanent: true,
  publishedAt: '2024-01-01T00:00:00Z',
  isDeleted: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  street: 'Storgatan 1',
  zipCode: '12345',
  city: 'Testköping',
  country: 'SE',
  latitude: 59.3,
  longitude: 18.0,
  autoAcceptBookings: false,
  description: '',
} as const

const SEED_ROUTE = {
  id: 'r1',
  name: 'Rundan',
  description: null,
  createdBy: 'user-1',
  startLatitude: null,
  startLongitude: null,
  plannedDate: null,
  isPublished: false,
  publishedAt: null,
  isDeleted: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  stops: [
    { fleaMarketId: 'm1', sortOrder: 0 },
    { fleaMarketId: 'm2', sortOrder: 1 },
    { fleaMarketId: 'm3', sortOrder: 2 },
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
