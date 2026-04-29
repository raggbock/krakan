import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { GeocodeError } from '@fyndstigen/shared'
import type { Deps } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import { useMarketForm } from './use-market-form'

global.URL.createObjectURL = vi.fn((f: File) => `blob:${f.name}`)
global.URL.revokeObjectURL = vi.fn()

// `geo` is not yet a port — still imported as a singleton from @/lib/api.
// We mock only the geo geocode function; everything else in @/lib/api is unused
// by the saga now that market/table/image calls go through Deps.
vi.mock('@/lib/api', () => ({
  geo: {
    geocode: vi.fn().mockResolvedValue({ lat: 59.33, lng: 18.07 }),
  },
}))

import { geo } from '@/lib/api'

// Build the in-memory Deps object ONCE — DepsProvider expects a stable reference.
// We spy on individual adapter methods per-test inside each describe block.
const testDeps: Deps = makeInMemoryDeps()

function createWrapper(deps: Deps = testDeps) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(DepsProvider, { deps }, children)
}

describe('useMarketForm — create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(geo.geocode).mockResolvedValue({ lat: 59.33, lng: 18.07 })
    // Re-apply default spies on the in-memory adapters for clean per-test state.
    vi.spyOn(testDeps.markets, 'create').mockResolvedValue({ id: 'market-1' })
    vi.spyOn(testDeps.markets, 'publish').mockResolvedValue(undefined)
    vi.spyOn(testDeps.markets, 'update').mockResolvedValue(undefined)
    vi.spyOn(testDeps.marketTables, 'create').mockResolvedValue({ id: 'table-1' })
    vi.spyOn(testDeps.marketTables, 'delete').mockResolvedValue(undefined)
    vi.spyOn(testDeps.images, 'add').mockResolvedValue({ id: 'img-1', storage_path: 'p/1.jpg', sort_order: 0 })
    vi.spyOn(testDeps.images, 'remove').mockResolvedValue(undefined)
  })

  it('compose: sub-hooks are exposed and independently mutable', () => {
    const { result } = renderHook(
      () => useMarketForm({ mode: 'create', organizerId: 'user-1' }),
      { wrapper: createWrapper() },
    )
    act(() => {
      result.current.fields.setName('Test Loppis')
      result.current.openingHours.addRule({ type: 'weekly', dayOfWeek: 6, anchorDate: null, openTime: '10:00', closeTime: '16:00' })
      result.current.tables.addBatch([{ label: 'Bord 1', description: '', priceSek: 100, sizeDescription: '2x1m' }])
    })
    expect(result.current.fields.name).toBe('Test Loppis')
    expect(result.current.openingHours.rules).toHaveLength(1)
    expect(result.current.tables.newTables).toHaveLength(1)
  })

  it('submit: full success flow calls saga and returns ok', async () => {
    const { result } = renderHook(
      () => useMarketForm({ mode: 'create', organizerId: 'user-1' }),
      { wrapper: createWrapper() },
    )
    act(() => {
      result.current.fields.setName('Test Loppis')
      result.current.fields.setAddress({ street: 'Storgatan 1', zipCode: '111 22', city: 'Stockholm', latitude: null, longitude: null })
    })
    let outcome: ReturnType<typeof result.current.submit> extends Promise<infer T> ? T : never
    await act(async () => {
      outcome = await result.current.submit()
    })
    expect(outcome!.ok).toBe(true)
    if (outcome!.ok) expect(outcome!.marketId).toBe('market-1')
    expect(testDeps.markets.create).toHaveBeenCalled()
    expect(testDeps.markets.publish).toHaveBeenCalledWith('market-1')
    expect(result.current.status.isSubmitting).toBe(false)
  })

  it('submit: returns error when fields are invalid', async () => {
    const { result } = renderHook(
      () => useMarketForm({ mode: 'create', organizerId: 'user-1' }),
      { wrapper: createWrapper() },
    )
    // name/address left empty → isValid = false
    let outcome: Awaited<ReturnType<typeof result.current.submit>>
    await act(async () => {
      outcome = await result.current.submit()
    })
    expect(outcome!.ok).toBe(false)
    expect(result.current.status.error).toBeTruthy()
    expect(testDeps.markets.create).not.toHaveBeenCalled()
  })

  it('submit: surfaces geocode error as Swedish message', async () => {
    vi.mocked(geo.geocode).mockRejectedValue(new GeocodeError('nowhere'))
    const { result } = renderHook(
      () => useMarketForm({ mode: 'create', organizerId: 'user-1' }),
      { wrapper: createWrapper() },
    )
    act(() => {
      result.current.fields.setName('Test')
      result.current.fields.setAddress({ street: 'Storgatan 1', zipCode: '111 22', city: 'Stockholm', latitude: null, longitude: null })
    })
    await act(async () => { await result.current.submit() })
    expect(result.current.status.error).toMatch(/kunde inte hitta den adressen/i)
  })
})

describe('useMarketForm — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(geo.geocode).mockResolvedValue({ lat: 59.33, lng: 18.07 })
    vi.spyOn(testDeps.markets, 'create').mockResolvedValue({ id: 'market-1' })
    vi.spyOn(testDeps.markets, 'publish').mockResolvedValue(undefined)
    vi.spyOn(testDeps.markets, 'update').mockResolvedValue(undefined)
    vi.spyOn(testDeps.marketTables, 'create').mockResolvedValue({ id: 'table-1' })
    vi.spyOn(testDeps.marketTables, 'delete').mockResolvedValue(undefined)
    vi.spyOn(testDeps.images, 'add').mockResolvedValue({ id: 'img-1', storage_path: 'p/1.jpg', sort_order: 0 })
    vi.spyOn(testDeps.images, 'remove').mockResolvedValue(undefined)
  })

  it('initialises fields from initial prop', () => {
    const initial = {
      id: 'mkt-1',
      name: 'Gamla loppisen',
      description: 'Gammal',
      street: 'Drottninggatan 1',
      zip_code: '111 51',
      city: 'Stockholm',
      latitude: 59.33,
      longitude: 18.07,
      is_permanent: false,
      auto_accept_bookings: true,
      published_at: '2025-01-01',
      organizer_id: 'u-1',
      organizerName: 'Test',
      opening_hour_rules: [],
      opening_hour_exceptions: [],
      flea_market_images: [],
      market_tables: [],
    } as any

    const { result } = renderHook(
      () => useMarketForm({ mode: 'edit', initial }),
      { wrapper: createWrapper() },
    )
    expect(result.current.fields.name).toBe('Gamla loppisen')
    expect(result.current.fields.isPermanent).toBe(false)
    expect(result.current.fields.autoAcceptBookings).toBe(true)
  })

  it('submit calls update (not create) and sets success message', async () => {
    const initial = {
      id: 'mkt-1',
      name: 'Loppisen',
      description: '',
      street: 'Gatan 1',
      zip_code: '111 00',
      city: 'Stad',
      latitude: 59.0,
      longitude: 18.0,
      is_permanent: true,
      auto_accept_bookings: false,
      published_at: '2025-01-01',
      organizer_id: 'u-1',
      organizerName: 'Test',
      opening_hour_rules: [],
      opening_hour_exceptions: [],
      flea_market_images: [],
      market_tables: [],
    } as any

    const { result } = renderHook(
      () => useMarketForm({ mode: 'edit', initial }),
      { wrapper: createWrapper() },
    )
    await act(async () => { await result.current.submit() })
    expect(testDeps.markets.update).toHaveBeenCalledWith('mkt-1', expect.any(Object))
    expect(testDeps.markets.create).not.toHaveBeenCalled()
    expect(result.current.status.success).toBe('Loppisen har uppdaterats!')
  })

  it('reseed: re-renders with new initial re-seeds all sub-hooks', () => {
    const initialA = {
      id: 'mkt-a',
      name: 'Loppis A',
      description: 'Beskriving A',
      street: 'Gatan 1',
      zip_code: '111 00',
      city: 'Stockholm',
      latitude: 59.33,
      longitude: 18.07,
      is_permanent: true,
      auto_accept_bookings: false,
      published_at: '2025-01-01',
      organizer_id: 'u-1',
      organizerName: 'Testaren',
      opening_hour_rules: [
        { type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
      ],
      opening_hour_exceptions: [],
      flea_market_images: [
        { id: 'img-a1', storage_path: 'a/1.jpg', sort_order: 0 },
      ],
      market_tables: [
        { id: 't-a1', label: 'Bord A1', description: '', price_sek: 100, size_description: '2x1m' },
      ],
    } as any

    const initialB = {
      id: 'mkt-b',
      name: 'Loppis B',
      description: 'Beskriving B',
      street: 'Vägen 2',
      zip_code: '222 00',
      city: 'Göteborg',
      latitude: 57.70,
      longitude: 11.97,
      is_permanent: false,
      auto_accept_bookings: true,
      published_at: '2025-06-01',
      organizer_id: 'u-2',
      organizerName: 'Testaren 2',
      opening_hour_rules: [
        { type: 'weekly', day_of_week: 0, anchor_date: null, open_time: '09:00', close_time: '15:00' },
        { type: 'weekly', day_of_week: 1, anchor_date: null, open_time: '09:00', close_time: '15:00' },
      ],
      opening_hour_exceptions: [],
      flea_market_images: [
        { id: 'img-b1', storage_path: 'b/1.jpg', sort_order: 0 },
        { id: 'img-b2', storage_path: 'b/2.jpg', sort_order: 1 },
      ],
      market_tables: [
        { id: 't-b1', label: 'Bord B1', description: '', price_sek: 200, size_description: '3x1m' },
        { id: 't-b2', label: 'Bord B2', description: '', price_sek: 150, size_description: '2x2m' },
      ],
    } as any

    const { result, rerender } = renderHook(
      ({ initial }: { initial: any }) => useMarketForm({ mode: 'edit', initial }),
      {
        wrapper: createWrapper(),
        initialProps: { initial: initialA },
      },
    )

    // Verify initial A is seeded
    expect(result.current.fields.name).toBe('Loppis A')
    expect(result.current.openingHours.rules).toHaveLength(1)
    expect(result.current.tables.existingTables).toHaveLength(1)
    expect(result.current.images.existingImages).toHaveLength(1)

    // Rerender with initialB — the reseed effect should fire
    act(() => {
      rerender({ initial: initialB })
    })

    expect(result.current.fields.name).toBe('Loppis B')
    expect(result.current.openingHours.rules).toHaveLength(2)
    expect(result.current.tables.existingTables).toHaveLength(2)
    expect(result.current.images.existingImages).toHaveLength(2)
  })
})
