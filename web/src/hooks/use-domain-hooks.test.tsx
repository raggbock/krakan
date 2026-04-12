import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMarkets, useMarketsByOrganizer } from './use-markets'
import { useRoute, useRoutesByUser } from './use-routes'
import { useMarketDetails } from './use-market-details'

vi.mock('@/lib/api', () => ({
  api: {
    fleaMarkets: {
      list: vi.fn().mockResolvedValue({ items: [{ id: 'm1', name: 'Loppis A' }], count: 1 }),
      listByOrganizer: vi.fn().mockResolvedValue([{ id: 'm2', name: 'Min loppis' }]),
      details: vi.fn().mockResolvedValue({ id: 'm1', name: 'Loppis A', organizer_id: 'u1' }),
    },
    marketTables: {
      list: vi.fn().mockResolvedValue([{ id: 't1', label: 'Bord 1' }]),
    },
    routes: {
      get: vi.fn().mockResolvedValue({ id: 'r1', name: 'Rundan', stops: [] }),
      listByUser: vi.fn().mockResolvedValue([{ id: 'r1', name: 'Rundan', stopCount: 3 }]),
    },
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useMarkets', () => {
  it('returns items and count from API', async () => {
    const { result } = renderHook(() => useMarkets({ page: 1, pageSize: 20 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toEqual([{ id: 'm1', name: 'Loppis A' }])
    expect(result.current.count).toBe(1)
    expect(result.current.error).toBeNull()
  })
})

describe('useMarketsByOrganizer', () => {
  it('returns markets for organizer', async () => {
    const { result } = renderHook(() => useMarketsByOrganizer('user-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.markets).toEqual([{ id: 'm2', name: 'Min loppis' }])
  })

  it('skips fetch when no organizerId', async () => {
    const { result } = renderHook(() => useMarketsByOrganizer(undefined), {
      wrapper: createWrapper(),
    })

    // With enabled: false, isLoading is false but isPending may be true
    // We check that no data is returned
    await waitFor(() => expect(result.current.markets).toEqual([]))
  })
})

describe('useMarketDetails', () => {
  it('fetches market and tables in parallel', async () => {
    const { result } = renderHook(() => useMarketDetails('m1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.market?.name).toBe('Loppis A')
    expect(result.current.tables).toEqual([{ id: 't1', label: 'Bord 1' }])
  })
})

describe('useRoute', () => {
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

describe('useRoutesByUser', () => {
  it('fetches routes for user', async () => {
    const { result } = renderHook(() => useRoutesByUser('user-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.routes).toHaveLength(1)
    expect(result.current.routes[0].name).toBe('Rundan')
  })
})
