import { renderHook, act } from '@testing-library/react'
import { GeocodeError } from '@fyndstigen/shared'
import { useCreateMarket, type CreateMarketInput } from './use-create-market'

vi.mock('@/lib/api', () => ({
  api: {
    fleaMarkets: {
      create: vi.fn().mockResolvedValue({ id: 'market-1' }),
      update: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
    },
    marketTables: {
      create: vi.fn().mockResolvedValue({ id: 'table-1' }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    images: {
      add: vi.fn().mockResolvedValue({ id: 'img-1', storage_path: 'p/1.jpg', sort_order: 0 }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  geo: {
    geocode: vi.fn().mockResolvedValue({ lat: 59.33, lng: 18.07 }),
  },
}))

import { api, geo } from '@/lib/api'

const baseInput: CreateMarketInput = {
  name: 'Test Loppis',
  description: 'En bra loppis',
  street: 'Storgatan 1',
  zipCode: '111 22',
  city: 'Stockholm',
  isPermanent: true,
  organizerId: 'user-1',
  tables: [{ label: 'Bord 1', description: '', priceSek: 200, sizeDescription: '2x1m' }],
  images: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })],
  openingHours: [{ type: 'weekly', dayOfWeek: 6, anchorDate: null, openTime: '10:00', closeTime: '16:00' }],
  openingHourExceptions: [],
}

describe('useCreateMarket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(geo.geocode).mockResolvedValue({ lat: 59.33, lng: 18.07 })
    vi.mocked(api.fleaMarkets.create).mockResolvedValue({ id: 'market-1' })
    vi.mocked(api.fleaMarkets.publish).mockResolvedValue(undefined as never)
    vi.mocked(api.marketTables.create).mockResolvedValue({ id: 'table-1' })
    vi.mocked(api.images.add).mockResolvedValue({ id: 'img-1' } as never)
  })

  it('full success: geocode → create → tables → images → publish', async () => {
    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    expect(outcome).toEqual({ id: 'market-1' })
    expect(geo.geocode).toHaveBeenCalledWith('Storgatan 1, 111 22 Stockholm, Sweden')
    expect(api.fleaMarkets.create).toHaveBeenCalled()
    expect(api.marketTables.create).toHaveBeenCalledTimes(1)
    expect(api.images.add).toHaveBeenCalledTimes(1)
    expect(api.fleaMarkets.publish).toHaveBeenCalledWith('market-1')
    expect(result.current.error).toBeNull()
    expect(result.current.isSubmitting).toBe(false)
  })

  it('returns id but sets error on table creation failure', async () => {
    vi.mocked(api.marketTables.create).mockRejectedValue(new Error('DB error'))

    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    // Market was created and published, but table creation failed
    expect(outcome).toEqual({ id: 'market-1' })
    expect(result.current.error).toContain('Bord 1')
    expect(result.current.error).toContain('publicerades')
    // Publish was already called before tables
    expect(api.fleaMarkets.publish).toHaveBeenCalledWith('market-1')
  })

  it('returns id but sets error on image upload failure', async () => {
    vi.mocked(api.images.add).mockRejectedValue(new Error('Storage error'))

    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    expect(outcome).toEqual({ id: 'market-1' })
    expect(result.current.error).toContain('bilder')
    // Publish was already called before images
    expect(api.fleaMarkets.publish).toHaveBeenCalledWith('market-1')
  })

  it('shows user-friendly error when geocoding fails', async () => {
    vi.mocked(geo.geocode).mockRejectedValue(new GeocodeError('Storgatan 1, 111 22 Stockholm, Sweden'))

    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    expect(outcome).toBeNull()
    // geocode.not_found → Swedish message from the shared catalog
    expect(result.current.error).toMatch(/kunde inte hitta den adressen/i)
  })

  it('returns null on market creation failure', async () => {
    vi.mocked(api.fleaMarkets.create).mockRejectedValue(new Error('Forbidden'))

    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    expect(outcome).toBeNull()
    // Unknown errors now surface the generic Swedish "unknown" message.
    expect(result.current.error).toMatch(/något gick fel/i)
  })

  it('skips tables and images when input has none', async () => {
    const { result } = renderHook(() => useCreateMarket())

    await act(async () => {
      await result.current.submit({ ...baseInput, tables: [], images: [] })
    })

    expect(api.marketTables.create).not.toHaveBeenCalled()
    expect(api.images.add).not.toHaveBeenCalled()
    expect(api.fleaMarkets.publish).toHaveBeenCalled()
  })

  it('resets isSubmitting after completion', async () => {
    const { result } = renderHook(() => useCreateMarket())

    expect(result.current.isSubmitting).toBe(false)

    await act(async () => {
      await result.current.submit(baseInput)
    })

    expect(result.current.isSubmitting).toBe(false)
  })
})
