'use client'

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useRouteBuilder } from './use-route-builder'
import type { RouteBuilderDeps } from './use-route-builder'
import type { FleaMarketNearBy, GeoService } from '@fyndstigen/shared'

// ---------------------------------------------------------------------------
// Mock next/navigation — must be hoisted
// ---------------------------------------------------------------------------
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

// ---------------------------------------------------------------------------
// Mock posthog-js/react — must be hoisted
// ---------------------------------------------------------------------------
const mockCapture = vi.fn()
vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockCapture }),
}))

// ---------------------------------------------------------------------------
// Mock DepsProvider + useAuth — hook pulls these unconditionally but tests
// inject everything via deps override, so we just need silent stubs.
// ---------------------------------------------------------------------------
vi.mock('@/providers/deps-provider', () => ({
  useDeps: () => ({
    routes: {
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      publish: vi.fn(),
      unpublish: vi.fn(),
      listByUser: vi.fn(),
      listPopular: vi.fn(),
    },
  }),
}))

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: null }),
}))

// Mock the geo module so the test doesn't transitively load @/lib/supabase
// (which throws under jsdom without env vars). Tests inject geo via deps.
vi.mock('@/lib/geo', () => ({
  geo: {
    nearbyMarkets: vi.fn(async () => []),
    optimizeStops: vi.fn((stops) => stops),
    geocode: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED_MARKET: FleaMarketNearBy = {
  id: 'm1',
  name: 'Loppis A',
  description: '',
  city: 'Testköping',
  is_permanent: false,
  latitude: 59.3,
  longitude: 18.0,
  distance_km: 1,
  published_at: '2024-01-01T00:00:00Z',
}

const SEED_MARKET_2: FleaMarketNearBy = {
  id: 'm2',
  name: 'Loppis B',
  description: '',
  city: 'Testköping',
  is_permanent: false,
  latitude: 59.4,
  longitude: 18.1,
  distance_km: 2,
  published_at: '2024-01-01T00:00:00Z',
}

function makeStorage(): Storage & { _data: Map<string, string> } {
  const _data = new Map<string, string>()
  return {
    _data,
    getItem: (k: string) => _data.get(k) ?? null,
    setItem: (k: string, v: string) => { _data.set(k, v) },
    removeItem: (k: string) => { _data.delete(k) },
    clear: () => { _data.clear() },
    key: (i: number) => Array.from(_data.keys())[i] ?? null,
    get length() { return _data.size },
  }
}

function makeRoutesPort(overrides?: Partial<RouteBuilderDeps['routes']>): RouteBuilderDeps['routes'] {
  return {
    create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    listByUser: vi.fn(),
    listPopular: vi.fn().mockResolvedValue([SEED_MARKET, SEED_MARKET_2]),
    ...overrides,
  }
}

function makeGeoPort(overrides?: Partial<GeoService>): GeoService {
  return {
    geocode: vi.fn(),
    nearbyMarkets: vi.fn().mockResolvedValue([SEED_MARKET, SEED_MARKET_2]),
    calculateRoute: vi.fn().mockResolvedValue(null),
    optimizeStops: vi.fn().mockImplementation((stops) => [...stops].reverse()),
    ...overrides,
  }
}

function makeGeolocation(overrides?: Partial<Geolocation>): Geolocation {
  return {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    ...overrides,
  }
}

function makeDeps(overrides?: Partial<RouteBuilderDeps>): RouteBuilderDeps {
  return {
    routes: makeRoutesPort(),
    geo: makeGeoPort(),
    storage: makeStorage(),
    geolocation: makeGeolocation(),
    posthog: { capture: mockCapture },
    router: { push: mockRouterPush },
    user: null,
    now: () => Date.now(),
    ...overrides,
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useRouteBuilder — markets fetched on mount', () => {
  it('fetches markets from geo port on mount', async () => {
    const deps = makeDeps()
    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    expect(result.current.markets).toBeUndefined()
    await waitFor(() => expect(result.current.markets).toBeDefined())
    expect(result.current.markets).toHaveLength(2)
    expect((deps.geo as GeoService).nearbyMarkets).toHaveBeenCalledOnce()
  })
})

describe('useRouteBuilder — draft restore', () => {
  const DRAFT_KEY = 'fyndstigen.route-draft.v1'

  it('skips restore when markets are not yet loaded', async () => {
    const storage = makeStorage()
    const geo = makeGeoPort({ nearbyMarkets: vi.fn().mockResolvedValue([]) })
    const savedAt = new Date(Date.now() - 60_000).toISOString()
    storage.setItem(DRAFT_KEY, JSON.stringify({
      name: 'Saved',
      plannedDate: '',
      useGps: true,
      customStart: null,
      stops: [{ marketId: 'm1', index: 0 }],
      savedAt,
    }))

    const deps = makeDeps({ geo, storage })
    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    // markets is empty, so stops should not be restored
    expect(result.current.stops).toHaveLength(0)
    expect(result.current.name).toBe('')
  })

  it('restores draft once markets are loaded', async () => {
    const storage = makeStorage()
    const savedAt = new Date(Date.now() - 60_000).toISOString()
    storage.setItem(DRAFT_KEY, JSON.stringify({
      name: 'Mina loppis',
      plannedDate: '2025-06-10',
      useGps: false,
      customStart: { lat: 59.1, lng: 18.0 },
      stops: [{ marketId: 'm1', index: 0 }],
      savedAt,
    }))

    const deps = makeDeps({ storage })
    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.stops).toHaveLength(1))
    expect(result.current.name).toBe('Mina loppis')
    expect(result.current.plannedDate).toBe('2025-06-10')
    expect(result.current.useGps).toBe(false)
    expect(result.current.customStart).toEqual({ lat: 59.1, lng: 18.0 })
  })

  it('honors 7-day TTL and discards expired draft', async () => {
    const storage = makeStorage()
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    storage.setItem(DRAFT_KEY, JSON.stringify({
      name: 'Old draft',
      plannedDate: '',
      useGps: true,
      customStart: null,
      stops: [{ marketId: 'm1', index: 0 }],
      savedAt: eightDaysAgo,
    }))

    const deps = makeDeps({ storage })
    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    // Wait a tick for the restore effect to run
    await waitFor(() => expect(result.current.markets!.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 50))

    expect(result.current.name).toBe('')
    expect(result.current.stops).toHaveLength(0)
    // Expired entry should have been purged
    expect(storage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('fires route_draft_restored exactly once with correct age_minutes', async () => {
    const storage = makeStorage()
    const now = Date.now()
    const ninetyMinsAgo = now - 90 * 60 * 1000
    const savedAt = new Date(ninetyMinsAgo).toISOString()
    storage.setItem(DRAFT_KEY, JSON.stringify({
      name: 'Draft',
      plannedDate: '',
      useGps: true,
      customStart: null,
      stops: [{ marketId: 'm1', index: 0 }],
      savedAt,
    }))

    const deps = makeDeps({
      storage,
      now: () => now,
    })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.stops).toHaveLength(1))

    expect(mockCapture).toHaveBeenCalledWith('route_draft_restored', {
      stop_count: 1,
      age_minutes: 90,
    })

    // Re-render should NOT fire it again
    mockCapture.mockClear()
    act(() => {
      result.current.setName('Updated')
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockCapture).not.toHaveBeenCalledWith('route_draft_restored', expect.anything())
  })
})

describe('useRouteBuilder — draft persist', () => {
  const DRAFT_KEY = 'fyndstigen.route-draft.v1'

  it('does not write to storage when stops are empty', async () => {
    const storage = makeStorage()
    const deps = makeDeps({ storage })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => { result.current.setName('Test name') })

    // Wait well past the 250ms debounce — no stops means nothing persisted
    await new Promise((r) => setTimeout(r, 400))
    expect(storage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('debounces persist at 250ms and writes after delay', async () => {
    const storage = makeStorage()
    const deps = makeDeps({ storage })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())

    // Switch to fake timers after markets have loaded (real timers were needed
    // for React Query's async resolution above).
    vi.useFakeTimers()

    // Add a stop so the persist effect fires
    act(() => { result.current.toggleStop('m1') })

    // Before the debounce fires
    act(() => { vi.advanceTimersByTime(100) })
    expect(storage.getItem(DRAFT_KEY)).toBeNull()

    // After the full 250ms debounce
    act(() => { vi.advanceTimersByTime(200) })
    expect(storage.getItem(DRAFT_KEY)).not.toBeNull()

    const stored = JSON.parse(storage.getItem(DRAFT_KEY)!)
    expect(stored.stops).toHaveLength(1)
    expect(stored.stops[0].marketId).toBe('m1')
    vi.useRealTimers()
  })
})

describe('useRouteBuilder — GPS', () => {
  it('calls getCurrentPosition only when useGps transitions false→true', async () => {
    const geolocation = makeGeolocation({
      getCurrentPosition: vi.fn(),
    })
    const deps = makeDeps({ geolocation, user: null })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())

    // Default useGps is true. GPS should have been called once on mount.
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce()

    // Setting same value (true → true) should not trigger another call
    act(() => { result.current.setUseGps(true) })
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce()

    // Turn off then on: false → true should call again
    act(() => { result.current.setUseGps(false) })
    act(() => { result.current.setUseGps(true) })
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2)
  })

  it('sets gpsError on permission denial without throwing', async () => {
    const geolocation = makeGeolocation({
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error({ code: 1, message: 'Permission denied' } as GeolocationPositionError)
      }),
    })
    const deps = makeDeps({ geolocation })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.gpsError).not.toBeNull())
    expect(result.current.gpsError).toContain('GPS')
  })
})

describe('useRouteBuilder — save (auth user)', () => {
  it('emits route_save_attempted → route_saved and redirects on complete', async () => {
    const routes = makeRoutesPort()
    const user = { id: 'user-1', email: 'test@test.se' }
    const deps = makeDeps({ routes, user })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())

    act(() => {
      result.current.toggleStop('m1')
      result.current.setName('Min runda')
    })

    await act(async () => {
      result.current.save()
      // Allow the async generator to run
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockCapture).toHaveBeenCalledWith('route_save_attempted', { stop_count: 1 })
    expect(mockCapture).toHaveBeenCalledWith('route_saved', expect.objectContaining({ route_id: 'rt-1' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/rundor/rt-1')
  })

  it('clears draft on successful save', async () => {
    const DRAFT_KEY = 'fyndstigen.route-draft.v1'
    const storage = makeStorage()
    const routes = makeRoutesPort()
    const user = { id: 'user-1', email: 'test@test.se' }
    const deps = makeDeps({ routes, user, storage })

    // Pre-populate storage with a draft
    storage.setItem(DRAFT_KEY, JSON.stringify({
      name: 'Old',
      plannedDate: '',
      useGps: true,
      customStart: null,
      stops: [{ marketId: 'm1', index: 0 }],
      savedAt: new Date().toISOString(),
    }))

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.stops).toHaveLength(1))

    act(() => { result.current.setName('Min runda') })

    await act(async () => {
      result.current.save()
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(storage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('emits route_save_failed with reason on failure', async () => {
    const routes = makeRoutesPort({
      create: vi.fn().mockRejectedValue(new Error('network error')),
    })
    const user = { id: 'user-1', email: 'test@test.se' }
    const deps = makeDeps({ routes, user })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => {
      result.current.toggleStop('m1')
      result.current.setName('Min runda')
    })

    await act(async () => {
      result.current.save()
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockCapture).toHaveBeenCalledWith('route_save_failed', expect.objectContaining({
      stop_count: 1,
    }))
    // draft should be preserved on failure
    expect(result.current.stops).toHaveLength(1)
  })
})

describe('useRouteBuilder — anon path', () => {
  it('fires route_login_blocked exactly once per session for unauth user with stops', async () => {
    const deps = makeDeps({ user: null })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())

    act(() => { result.current.toggleStop('m1') })
    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('route_login_blocked', expect.any(Object))
    )
    const callCount = mockCapture.mock.calls.filter(
      ([event]) => event === 'route_login_blocked'
    ).length
    expect(callCount).toBe(1)

    // Re-trigger by changing name — should NOT fire again
    act(() => { result.current.setName('changed') })
    await new Promise((r) => setTimeout(r, 50))

    const callCountAfter = mockCapture.mock.calls.filter(
      ([event]) => event === 'route_login_blocked'
    ).length
    expect(callCountAfter).toBe(1)
  })

  it('does not fire route_login_blocked when stops is empty', async () => {
    const deps = makeDeps({ user: null })

    renderHook(() => useRouteBuilder({ deps }), { wrapper: createWrapper() })

    await new Promise((r) => setTimeout(r, 100))
    expect(mockCapture).not.toHaveBeenCalledWith('route_login_blocked', expect.any(Object))
  })
})

describe('useRouteBuilder — optimize', () => {
  it('is a no-op below 2 stops', async () => {
    const geo = makeGeoPort()
    const deps = makeDeps({ geo })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => { result.current.toggleStop('m1') })

    await act(async () => { await result.current.optimize() })

    expect((geo as GeoService).optimizeStops).not.toHaveBeenCalled()
    expect(result.current.stops).toHaveLength(1)
  })

  it('reorders stops via geo.optimizeStops with correct startPoint (GPS)', async () => {
    const geolocation = makeGeolocation({
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({ coords: { latitude: 59.0, longitude: 18.0 } } as GeolocationPosition)
      }),
    })
    const geo = makeGeoPort({
      optimizeStops: vi.fn().mockImplementation((stops) => [...stops].reverse()),
    })
    const deps = makeDeps({ geo, geolocation })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => {
      result.current.toggleStop('m1')
      result.current.toggleStop('m2')
    })

    await act(async () => { await result.current.optimize() })

    expect((geo as GeoService).optimizeStops).toHaveBeenCalledWith(
      expect.any(Array),
      { lat: 59.0, lng: 18.0 },
    )
    // Should be reversed (mock returns reversed)
    expect(result.current.stops[0].market.id).toBe('m2')
    expect(result.current.stops[1].market.id).toBe('m1')
  })

  it('reorders stops via geo.optimizeStops with correct startPoint (custom)', async () => {
    const geo = makeGeoPort({
      optimizeStops: vi.fn().mockImplementation((stops) => [...stops].reverse()),
    })
    const deps = makeDeps({ geo })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => {
      result.current.setUseGps(false)
      result.current.setCustomStart({ lat: 60.0, lng: 17.0 })
      result.current.toggleStop('m1')
      result.current.toggleStop('m2')
    })

    await act(async () => { await result.current.optimize() })

    expect((geo as GeoService).optimizeStops).toHaveBeenCalledWith(
      expect.any(Array),
      { lat: 60.0, lng: 17.0 },
    )
  })

  it('passes undefined startPoint when no GPS pos and no custom start', async () => {
    const geo = makeGeoPort({
      optimizeStops: vi.fn().mockImplementation((stops) => stops),
    })
    const geolocation = makeGeolocation({
      getCurrentPosition: vi.fn(), // never calls success
    })
    const deps = makeDeps({ geo, geolocation })

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => {
      result.current.setUseGps(false)
      result.current.toggleStop('m1')
      result.current.toggleStop('m2')
    })

    await act(async () => { await result.current.optimize() })

    expect((geo as GeoService).optimizeStops).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
    )
  })
})

describe('useRouteBuilder — toggleStop fires route_market_added', () => {
  it('fires route_market_added when adding a new market', async () => {
    const deps = makeDeps()

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => { result.current.toggleStop('m1') })

    expect(mockCapture).toHaveBeenCalledWith('route_market_added', expect.objectContaining({
      flea_market_id: 'm1',
    }))
  })

  it('does not fire route_market_added when removing a market', async () => {
    const deps = makeDeps()

    const { result } = renderHook(() => useRouteBuilder({ deps }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.markets).toBeDefined())
    act(() => { result.current.toggleStop('m1') })
    mockCapture.mockClear()
    act(() => { result.current.toggleStop('m1') })

    expect(mockCapture).not.toHaveBeenCalledWith('route_market_added', expect.anything())
  })
})

describe('useRouteBuilder — mode guard', () => {
  it('throws when mode is edit (not yet implemented)', () => {
    expect(() => {
      const deps = makeDeps()
      renderHook(() => useRouteBuilder({ mode: 'edit', deps }), {
        wrapper: createWrapper(),
      })
    }).toThrow()
  })
})
