import { renderHook, act } from '@testing-library/react'
import { useCreateMarket, type CreateMarketInput } from './use-create-market'

vi.mock('@/lib/api', () => ({
  api: {
    fleaMarkets: {
      create: vi.fn().mockResolvedValue({ id: 'market-1' }),
      publish: vi.fn().mockResolvedValue(undefined),
    },
    marketTables: {
      create: vi.fn().mockResolvedValue({ id: 'table-1' }),
    },
    images: {
      upload: vi.fn().mockResolvedValue({ id: 'img-1' }),
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
}

describe('useCreateMarket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(geo.geocode).mockResolvedValue({ lat: 59.33, lng: 18.07 })
    vi.mocked(api.fleaMarkets.create).mockResolvedValue({ id: 'market-1' })
    vi.mocked(api.fleaMarkets.publish).mockResolvedValue(undefined as never)
    vi.mocked(api.marketTables.create).mockResolvedValue({ id: 'table-1' })
    vi.mocked(api.images.upload).mockResolvedValue({ id: 'img-1' } as never)
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
    expect(api.images.upload).toHaveBeenCalledTimes(1)
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

    // Market was created, returned as draft
    expect(outcome).toEqual({ id: 'market-1' })
    expect(result.current.error).toContain('Bord 1')
    expect(result.current.error).toContain('utkast')
    // Publish should NOT have been called
    expect(api.fleaMarkets.publish).not.toHaveBeenCalled()
  })

  it('returns id but sets error on image upload failure', async () => {
    vi.mocked(api.images.upload).mockRejectedValue(new Error('Storage error'))

    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    expect(outcome).toEqual({ id: 'market-1' })
    expect(result.current.error).toContain('bilder')
    expect(api.fleaMarkets.publish).not.toHaveBeenCalled()
  })

  it('returns null on market creation failure', async () => {
    vi.mocked(api.fleaMarkets.create).mockRejectedValue(new Error('Forbidden'))

    const { result } = renderHook(() => useCreateMarket())

    let outcome: { id: string } | null = null
    await act(async () => {
      outcome = await result.current.submit(baseInput)
    })

    expect(outcome).toBeNull()
    expect(result.current.error).toBe('Forbidden')
  })

  it('skips tables and images when input has none', async () => {
    const { result } = renderHook(() => useCreateMarket())

    await act(async () => {
      await result.current.submit({ ...baseInput, tables: [], images: [] })
    })

    expect(api.marketTables.create).not.toHaveBeenCalled()
    expect(api.images.upload).not.toHaveBeenCalled()
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
