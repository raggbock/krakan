import { describe, it, expect, vi } from 'vitest'
import { runMarketMutation, type MarketDeps, type MarketEvent, type MarketPlan } from './market-mutation'
import { GeocodeError } from './geo'

function makeFile(name = 'pic.jpg'): File {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function makeApi(overrides: Partial<MarketDeps['api']> = {}): MarketDeps['api'] {
  return {
    fleaMarkets: {
      create: vi.fn().mockResolvedValue({ id: 'market-1' }),
      update: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      ...(overrides.fleaMarkets ?? {}),
    },
    marketTables: {
      create: vi.fn().mockResolvedValue({ id: 'table-1' }),
      delete: vi.fn().mockResolvedValue(undefined),
      ...(overrides.marketTables ?? {}),
    },
    images: {
      add: vi.fn().mockResolvedValue({ id: 'img-1', storage_path: 'p/1.jpg', sort_order: 0 }),
      remove: vi.fn().mockResolvedValue(undefined),
      ...(overrides.images ?? {}),
    },
  }
}

function makeGeo(
  impl: MarketDeps['geo']['geocode'] = vi.fn().mockResolvedValue({ lat: 59.33, lng: 18.07 }),
): MarketDeps['geo'] {
  return { geocode: impl }
}

async function collect(
  plan: MarketPlan,
  deps: MarketDeps,
): Promise<MarketEvent[]> {
  const events: MarketEvent[] = []
  for await (const ev of runMarketMutation(plan, deps)) events.push(ev)
  return events
}

const createPlan: MarketPlan = {
  market: {
    create: {
      name: 'Test Loppis',
      description: 'En bra loppis',
      address: { street: 'Storgatan 1', zipCode: '111 22', city: 'Stockholm' },
      isPermanent: true,
      organizerId: 'user-1',
    },
  },
  images: { add: [makeFile('a.jpg')], remove: [] },
  tables: {
    add: [{ label: 'Bord 1', description: '', priceSek: 200, sizeDescription: '2x1m' }],
    remove: [],
  },
  opening: {
    rules: [
      { type: 'weekly', dayOfWeek: 6, anchorDate: null, openTime: '10:00', closeTime: '16:00' },
    ],
    exceptions: [],
  },
}

describe('runMarketMutation — create new market', () => {
  it('emits full happy-path event sequence', async () => {
    const api = makeApi()
    const geo = makeGeo()
    const events = await collect(createPlan, { api, geo })

    const phases = events.map((e) => ('phase' in e ? `${e.phase}:${e.status}` : `end:${e.type}`))
    expect(phases).toEqual([
      'geocoding:start',
      'geocoding:ok',
      'saving_market:start',
      'saving_market:ok',
      'publishing:start',
      'publishing:ok',
      'saving_tables:start',
      'saving_tables:item_ok',
      'saving_tables:done',
      'saving_images:start',
      'saving_images:item_ok',
      'saving_images:done',
      'end:complete',
    ])

    expect(api.fleaMarkets.create).toHaveBeenCalledTimes(1)
    expect(api.fleaMarkets.publish).toHaveBeenCalledWith('market-1')
    expect(api.marketTables.create).toHaveBeenCalledTimes(1)
    expect(api.images.add).toHaveBeenCalledTimes(1)

    const complete = events.at(-1)!
    expect(complete).toEqual({ type: 'complete', marketId: 'market-1' })
  })

  it('skips geocoding when coordinates are pre-supplied', async () => {
    const api = makeApi()
    const geo = makeGeo()
    const plan: MarketPlan = {
      ...createPlan,
      market: {
        create: {
          ...createPlan.market['create' as keyof typeof createPlan.market]!,
          address: {
            street: 'Storgatan 1',
            zipCode: '111 22',
            city: 'Stockholm',
            coordinates: { latitude: 1, longitude: 2 },
          },
        },
      },
    }
    const events = await collect(plan, { api, geo })

    expect(geo.geocode).not.toHaveBeenCalled()
    expect(events[0]).toEqual({ phase: 'geocoding', status: 'skipped' })
  })
})

describe('runMarketMutation — failures', () => {
  it('critical: geocode failure emits failed with geocode.not_found and terminates', async () => {
    const api = makeApi()
    const geo = makeGeo(vi.fn().mockRejectedValue(new GeocodeError('Storgatan 1')))
    const events = await collect(createPlan, { api, geo })

    const last = events.at(-1)!
    expect(last).toEqual({ type: 'failed', error: expect.objectContaining({ code: 'geocode.not_found' }) })
    expect(api.fleaMarkets.create).not.toHaveBeenCalled()
  })

  it('critical: create-market failure emits failed and terminates', async () => {
    const api = makeApi({
      fleaMarkets: {
        create: vi.fn().mockRejectedValue(new Error('Forbidden')),
        update: vi.fn(),
        publish: vi.fn(),
      },
    })
    const events = await collect(createPlan, { api, geo: makeGeo() })

    const last = events.at(-1)!
    expect('type' in last && last.type).toBe('failed')
    expect(api.fleaMarkets.publish).not.toHaveBeenCalled()
    expect(api.marketTables.create).not.toHaveBeenCalled()
  })

  it('non-critical: single image upload failure emits item_error and continues to complete', async () => {
    const addMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Storage error'))
      .mockResolvedValueOnce({ id: 'img-2', storage_path: 'p/2.jpg', sort_order: 1 })
    const api = makeApi({
      images: { add: addMock, remove: vi.fn().mockResolvedValue(undefined) },
    })

    const plan: MarketPlan = {
      ...createPlan,
      images: { add: [makeFile('a.jpg'), makeFile('b.jpg')], remove: [] },
    }
    const events = await collect(plan, { api, geo: makeGeo() })

    const imageEvents = events.filter((e) => 'phase' in e && e.phase === 'saving_images')
    // start + 2 items + done
    expect(imageEvents).toHaveLength(4)
    expect(imageEvents[1]).toMatchObject({ status: 'item_error', kind: 'add', index: 0 })
    expect(imageEvents[2]).toMatchObject({ status: 'item_ok', kind: 'add', index: 1 })
    expect(events.at(-1)).toEqual({ type: 'complete', marketId: 'market-1' })
  })

  it('non-critical: table create failure emits item_error and continues', async () => {
    const createMock = vi
      .fn()
      .mockResolvedValueOnce({ id: 't-1' })
      .mockRejectedValueOnce(new Error('DB error'))
    const api = makeApi({
      marketTables: { create: createMock, delete: vi.fn().mockResolvedValue(undefined) },
    })
    const plan: MarketPlan = {
      ...createPlan,
      tables: {
        add: [
          { label: 'A', description: '', priceSek: 100, sizeDescription: '' },
          { label: 'B', description: '', priceSek: 100, sizeDescription: '' },
        ],
        remove: [],
      },
    }
    const events = await collect(plan, { api, geo: makeGeo() })
    const tableEvents = events.filter((e) => 'phase' in e && e.phase === 'saving_tables')
    expect(tableEvents[1]).toMatchObject({ status: 'item_ok', kind: 'add', index: 0 })
    expect(tableEvents[2]).toMatchObject({ status: 'item_error', kind: 'add', index: 1 })
    expect(events.at(-1)).toMatchObject({ type: 'complete' })
  })
})

describe('runMarketMutation — edit existing market', () => {
  const editPlan: MarketPlan = {
    market: {
      update: {
        id: 'market-9',
        patch: {
          name: 'Test',
          description: 'x',
          address: {
            street: 'Storgatan 1',
            zipCode: '111 22',
            city: 'Stockholm',
            coordinates: { latitude: 1, longitude: 2 },
          },
          isPermanent: true,
          alreadyPublished: true,
        },
      },
    },
    images: {
      add: [makeFile('new.jpg')],
      remove: [{ id: 'old-img', storage_path: 'p/old.jpg', sort_order: 0 }],
    },
    tables: {
      add: [{ label: 'N', description: '', priceSek: 50, sizeDescription: '' }],
      remove: ['old-table'],
    },
    opening: { rules: [], exceptions: [] },
  }

  it('skips publishing when alreadyPublished and applies removes before adds', async () => {
    const api = makeApi()
    const events = await collect(editPlan, { api, geo: makeGeo() })

    expect(api.fleaMarkets.update).toHaveBeenCalledTimes(1)
    expect(api.fleaMarkets.publish).not.toHaveBeenCalled()

    const publishEv = events.find((e) => 'phase' in e && e.phase === 'publishing')
    expect(publishEv).toEqual({ phase: 'publishing', status: 'skipped' })

    // Removes emitted before adds in both phases
    const tableEvents = events.filter((e) => 'phase' in e && e.phase === 'saving_tables')
    const firstItem = tableEvents.find((e) => 'status' in e && e.status !== 'start' && e.status !== 'done')!
    expect(firstItem).toMatchObject({ kind: 'remove' })

    const imageEvents = events.filter((e) => 'phase' in e && e.phase === 'saving_images')
    const firstImgItem = imageEvents.find((e) => 'status' in e && e.status !== 'start' && e.status !== 'done')!
    expect(firstImgItem).toMatchObject({ kind: 'remove' })
  })

  it('edit with partial image failure still completes', async () => {
    const api = makeApi({
      images: {
        add: vi.fn().mockRejectedValue(new Error('boom')),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    })
    const events = await collect(editPlan, { api, geo: makeGeo() })
    const errEv = events.find(
      (e) => 'phase' in e && e.phase === 'saving_images' && 'status' in e && e.status === 'item_error',
    )
    expect(errEv).toBeDefined()
    expect(events.at(-1)).toMatchObject({ type: 'complete', marketId: 'market-9' })
  })
})
