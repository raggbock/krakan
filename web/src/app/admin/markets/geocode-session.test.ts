import { describe, it, expect, vi } from 'vitest'
import { runGeocodeSession } from './geocode-session'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'
import type { GeocodeOutcome } from './bulk-geocode'

function makeRow(overrides: Partial<AdminMarketRow> = {}): AdminMarketRow {
  return {
    id: 'r1',
    slug: null,
    name: 'Test',
    city: 'Stockholm',
    street: 'Testgatan 1',
    zipCode: '12345',
    country: 'SE',
    status: 'confirmed',
    category: null,
    isSystemOwned: false,
    isPublished: true,
    isPermanent: true,
    contactWebsite: null,
    contactFacebook: null,
    contactInstagram: null,
    contactPhone: null,
    contactEmail: null,
    hasWebsite: false,
    hasFacebook: false,
    hasInstagram: false,
    hasPhone: false,
    hasEmail: false,
    hasOpeningHours: false,
    hasCoordinates: false,
    latitude: null,
    longitude: null,
    openingHourRules: [],
    takeover: null,
    updatedAt: null,
    ...overrides,
  }
}

async function* makeGenerator(outcomes: GeocodeOutcome[]): AsyncGenerator<GeocodeOutcome> {
  for (const o of outcomes) yield o
}

describe('runGeocodeSession', () => {
  it('calls editFn for each successful geocode result', async () => {
    const market = makeRow({ id: 'm1' })
    const outcomes: GeocodeOutcome[] = [{ marketId: 'm1', ok: true, latitude: 59.3, longitude: 18.0 }]
    const editFn = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn()

    await runGeocodeSession(
      [market],
      (_, __) => makeGenerator(outcomes),
      onProgress,
      editFn,
    )

    expect(editFn).toHaveBeenCalledOnce()
    expect(editFn).toHaveBeenCalledWith('m1', { location: { latitude: 59.3, longitude: 18.0 } })
  })

  it('does not call editFn for failed geocode results', async () => {
    const market = makeRow({ id: 'm1' })
    const outcomes: GeocodeOutcome[] = [{ marketId: 'm1', ok: false, reason: 'no_match' }]
    const editFn = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn()

    await runGeocodeSession(
      [market],
      (_, __) => makeGenerator(outcomes),
      onProgress,
      editFn,
    )

    expect(editFn).not.toHaveBeenCalled()
  })

  it('reports correct final counts for mixed results', async () => {
    const m1 = makeRow({ id: 'm1' })
    const m2 = makeRow({ id: 'm2' })
    const outcomes: GeocodeOutcome[] = [
      { marketId: 'm1', ok: true, latitude: 59.3, longitude: 18.0 },
      { marketId: 'm2', ok: false, reason: 'no_match' },
    ]
    const editFn = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn()

    const result = await runGeocodeSession(
      [m1, m2],
      (_, __) => makeGenerator(outcomes),
      onProgress,
      editFn,
    )

    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('calls onProgress for each outcome', async () => {
    const m1 = makeRow({ id: 'm1' })
    const m2 = makeRow({ id: 'm2' })
    const outcomes: GeocodeOutcome[] = [
      { marketId: 'm1', ok: true, latitude: 59.3, longitude: 18.0 },
      { marketId: 'm2', ok: false, reason: 'no_match' },
    ]
    const editFn = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn()

    await runGeocodeSession(
      [m1, m2],
      (_, __) => makeGenerator(outcomes),
      onProgress,
      editFn,
    )

    expect(onProgress).toHaveBeenCalledTimes(2)
    const lastCall = onProgress.mock.calls[1][0]
    expect(lastCall.done).toBe(2)
    expect(lastCall.total).toBe(2)
    expect(lastCall.succeeded).toBe(1)
    expect(lastCall.failed).toBe(1)
  })

  it('returns zero counts for empty market list', async () => {
    const editFn = vi.fn()
    const onProgress = vi.fn()

    const result = await runGeocodeSession(
      [],
      (_, __) => makeGenerator([]),
      onProgress,
      editFn,
    )

    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
    expect(editFn).not.toHaveBeenCalled()
  })

  it('onProgress receives current market on first call', async () => {
    const m1 = makeRow({ id: 'm1', name: 'First' })
    const outcomes: GeocodeOutcome[] = [{ marketId: 'm1', ok: true, latitude: 59.3, longitude: 18.0 }]
    const editFn = vi.fn().mockResolvedValue(undefined)
    const onProgress = vi.fn()

    await runGeocodeSession(
      [m1],
      (_, __) => makeGenerator(outcomes),
      onProgress,
      editFn,
    )

    const firstCall = onProgress.mock.calls[0][0]
    expect(firstCall.total).toBe(1)
    expect(firstCall.done).toBe(1)
  })
})
