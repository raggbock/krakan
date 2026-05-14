import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchDrivingRoute } from './routing'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchDrivingRoute', () => {
  it('returns null for fewer than 2 stops without hitting the network', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    expect(await fetchDrivingRoute([])).toBeNull()
    expect(await fetchDrivingRoute([{ lat: 59.3, lng: 18.0 }])).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('forwards the AbortSignal to fetch so callers can cancel in-flight requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          routes: [
            {
              geometry: { coordinates: [] },
              legs: [],
              distance: 0,
              duration: 0,
            },
          ],
        }),
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const controller = new AbortController()
    await fetchDrivingRoute(
      [
        { lat: 59.3, lng: 18.0 },
        { lat: 59.4, lng: 18.1 },
      ],
      controller.signal,
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })

  it('returns null when fetch rejects (e.g. aborted)', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException('Aborted', 'AbortError')) as unknown as typeof fetch
    const result = await fetchDrivingRoute(
      [
        { lat: 59.3, lng: 18.0 },
        { lat: 59.4, lng: 18.1 },
      ],
      new AbortController().signal,
    )
    expect(result).toBeNull()
  })

  it('flips OSRM lng,lat geometry to Leaflet lat,lng pairs', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          routes: [
            {
              geometry: {
                coordinates: [
                  [18.0, 59.3],
                  [18.1, 59.4],
                ],
              },
              legs: [{ distance: 1000, duration: 60 }],
              distance: 1000,
              duration: 60,
            },
          ],
        }),
    }) as unknown as typeof fetch
    const result = await fetchDrivingRoute([
      { lat: 59.3, lng: 18.0 },
      { lat: 59.4, lng: 18.1 },
    ])
    expect(result?.geometry).toEqual([
      [59.3, 18.0],
      [59.4, 18.1],
    ])
    expect(result?.totalDistance).toBe(1000)
  })

  it('returns null on non-OK HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch
    expect(
      await fetchDrivingRoute([
        { lat: 59.3, lng: 18.0 },
        { lat: 59.4, lng: 18.1 },
      ]),
    ).toBeNull()
  })
})
