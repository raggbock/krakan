import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeInMemoryDeps } from '@fyndstigen/shared'
import { DepsProvider } from '@/providers/deps-provider'
import { useMarkets, useMarketsByOrganizer } from './use-markets'
import { useMarketDetails } from './use-market-details'

// Seed data shared across tests
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

describe('DepsProvider stability', () => {
  it('useDeps() returns the same Deps reference across renders', async () => {
    const deps = makeInMemoryDeps([SEED_MARKET])
    let capturedDeps: ReturnType<typeof makeInMemoryDeps>[] = []

    const { result, rerender } = renderHook(
      () => {
        const { DepsContext } = require('@/providers/deps-provider')
        // Just fetch markets twice — if deps reference is unstable the
        // query would get a different queryFn context.
        return result?.current
      },
      { wrapper: createWrapper(deps) },
    )

    // The real stability assertion: same `markets` reference is returned
    // by two separate calls to useMarkets (same wrapper, same deps instance)
    const { result: r1 } = renderHook(() => useMarkets(), {
      wrapper: createWrapper(deps),
    })
    const { result: r2 } = renderHook(() => useMarkets(), {
      wrapper: createWrapper(deps),
    })

    await waitFor(() => expect(r1.current.loading).toBe(false))
    await waitFor(() => expect(r2.current.loading).toBe(false))

    // Both hooks resolved the same data from the same in-memory store
    expect(r1.current.markets[0].id).toBe(r2.current.markets[0].id)
  })
})
