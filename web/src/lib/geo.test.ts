import { createGeo } from '@fyndstigen/shared'

// Minimal Supabase mock for geo service (only nearbyMarkets uses it)
const mockSupabase = {
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
} as any

const originalFetch = globalThis.fetch

describe('createGeo', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('geocode', () => {
    it('returns coordinates on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve([{ lat: '59.33', lon: '18.07', display_name: 'Stockholm' }]),
      })

      const geo = createGeo(mockSupabase)
      const result = await geo.geocode('Stockholm, Sweden')

      expect(result).toEqual({ lat: 59.33, lng: 18.07 })
    })

    it('returns fallback when no results', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve([]),
      })

      const geo = createGeo(mockSupabase)
      const result = await geo.geocode('xyznonexistent')

      // Default fallback is Stockholm
      expect(result).toEqual({ lat: 59.33, lng: 18.07 })
    })

    it('returns fallback on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const geo = createGeo(mockSupabase)
      const result = await geo.geocode('Stockholm')

      expect(result).toEqual({ lat: 59.33, lng: 18.07 })
    })

    it('returns custom fallback on failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'))

      const geo = createGeo(mockSupabase, { fallback: { lat: 57.7, lng: 11.97 } })
      const result = await geo.geocode('whatever')

      expect(result).toEqual({ lat: 57.7, lng: 11.97 })
    })

    it('returns fallback on timeout (abort)', async () => {
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      )

      const geo = createGeo(mockSupabase, { timeoutMs: 50 })
      const result = await geo.geocode('Slow address')

      expect(result).toEqual({ lat: 59.33, lng: 18.07 })
    })
  })

  describe('nearbyMarkets', () => {
    it('calls supabase rpc with correct params', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [{ id: 'm1' }], error: null })

      const geo = createGeo(mockSupabase)
      const result = await geo.nearbyMarkets({ lat: 59.0, lng: 18.0 }, 30)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('nearby_flea_markets', {
        lat: 59.0,
        lng: 18.0,
        radius_km: 30,
      })
      expect(result).toEqual([{ id: 'm1' }])
    })
  })

  describe('optimizeStops', () => {
    it('reorders stops by nearest neighbor', () => {
      const geo = createGeo(mockSupabase)
      const stops = [
        { id: 'a', lat: 59.0, lng: 18.0 },
        { id: 'b', lat: 60.0, lng: 18.0 },
        { id: 'c', lat: 59.5, lng: 18.0 },
      ]
      const result = geo.optimizeStops(stops)

      // From a(59.0) → nearest is c(59.5) → then b(60.0)
      expect(result.map((s) => s.id)).toEqual(['a', 'c', 'b'])
    })

    it('returns empty array for empty input', () => {
      const geo = createGeo(mockSupabase)
      expect(geo.optimizeStops([])).toEqual([])
    })
  })
})
