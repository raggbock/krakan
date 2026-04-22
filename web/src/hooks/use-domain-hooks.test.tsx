import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeInMemoryDeps } from '@fyndstigen/shared'
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

// Routes haven't been migrated to DepsProvider yet — they still go through
// `api.routes.*`. Keep the mock-based tests so route hooks stay covered.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    api: {
      ...actual.api,
      routes: {
        get: vi.fn().mockResolvedValue({ id: 'r1', name: 'Rundan', stops: [] }),
        listByUser: vi.fn().mockResolvedValue([{ id: 'r1', name: 'Rundan', stopCount: 3 }]),
      },
    },
  }
})

function createWrapper(deps = makeInMemoryDeps([SEED_MARKET])) {
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

describe('useRoute — still on api.* (not migrated)', () => {
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

describe('useRoutesByUser — still on api.* (not migrated)', () => {
  it('fetches routes for user', async () => {
    const { result } = renderHook(() => useRoutesByUser('user-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.routes).toHaveLength(1)
    expect(result.current.routes[0].name).toBe('Rundan')
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
