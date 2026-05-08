import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useMarketDetailViewModel } from './use-market-detail-view-model'

const mockUseMarketDetails = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('./use-market-details', () => ({
  useMarketDetails: (id: string) => mockUseMarketDetails(id),
}))

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/urls', () => ({
  marketEditUrl: ({ id }: { id: string }) => `/profile/markets/${id}/edit`,
}))

const baseMarket = {
  id: 'fm-1',
  name: 'Stortorget',
  slug: 'stortorget',
  organizer_id: 'org-1',
  latitude: 59.27,
  longitude: 15.21,
  flea_market_images: [],
  opening_hour_rules: [],
  opening_hour_exceptions: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ user: null, loading: false })
  mockUseMarketDetails.mockReturnValue({
    market: null,
    tables: [],
    loading: false,
    error: null,
  })
})

describe('useMarketDetailViewModel', () => {
  describe('openingHours', () => {
    it('returns undefined when both rules and exceptions are empty', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.openingHours).toBeUndefined()
    })

    it('returns rules when only rules are present', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket, opening_hour_rules: [{ id: 'r1' }] },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.openingHours).toEqual({
        rules: [{ id: 'r1' }],
        exceptions: [],
      })
    })

    it('returns exceptions when only exceptions are present', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket, opening_hour_exceptions: [{ id: 'e1' }] },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.openingHours).toEqual({
        rules: [],
        exceptions: [{ id: 'e1' }],
      })
    })

    it('returns undefined when market is null', () => {
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.openingHours).toBeUndefined()
    })
  })

  describe('isOwner', () => {
    it('is false when user is not signed in', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.isOwner).toBe(false)
    })

    it('is true when user.id matches market.organizer_id', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'org-1' }, loading: false })
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.isOwner).toBe(true)
    })

    it('is false when user.id differs', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'someone-else' }, loading: false })
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.isOwner).toBe(false)
    })

    it('is false when market is null even if user matches some id', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'org-1' }, loading: false })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.isOwner).toBe(false)
    })
  })

  describe('editUrl', () => {
    it('builds URL from id', () => {
      const { result } = renderHook(() => useMarketDetailViewModel('fm-99'))
      expect(result.current.editUrl).toBe('/profile/markets/fm-99/edit')
    })
  })

  describe('mapUrl', () => {
    it('falls back to /map when market has no coordinates', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket, latitude: null, longitude: null },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.mapUrl).toBe('/map')
    })

    it('builds /map?lat=...&lng=...&name=... with slug when present', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.mapUrl).toContain('lat=59.27')
      expect(result.current.mapUrl).toContain('lng=15.21')
      expect(result.current.mapUrl).toContain('name=Stortorget')
      expect(result.current.mapUrl).toContain('slug=stortorget')
    })

    it('omits slug when market has none', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket, slug: null },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.mapUrl).not.toContain('slug=')
    })

    it('falls back to /map when market is null', () => {
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.mapUrl).toBe('/map')
    })
  })

  describe('images', () => {
    it('sorts by sort_order ascending', () => {
      mockUseMarketDetails.mockReturnValue({
        market: {
          ...baseMarket,
          flea_market_images: [
            { id: 'i3', storage_path: 'c', sort_order: 3 },
            { id: 'i1', storage_path: 'a', sort_order: 1 },
            { id: 'i2', storage_path: 'b', sort_order: 2 },
          ],
        },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.images.map((i) => i.id)).toEqual(['i1', 'i2', 'i3'])
    })

    it('returns empty array when market has no images', () => {
      mockUseMarketDetails.mockReturnValue({
        market: { ...baseMarket },
        tables: [],
        loading: false,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.images).toEqual([])
    })

    it('returns empty array when market is null', () => {
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.images).toEqual([])
    })
  })

  describe('passthrough', () => {
    it('exposes loading and error', () => {
      mockUseMarketDetails.mockReturnValue({
        market: null,
        tables: [],
        loading: true,
        error: null,
      })
      const { result } = renderHook(() => useMarketDetailViewModel('fm-1'))
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBe(null)
    })
  })
})
