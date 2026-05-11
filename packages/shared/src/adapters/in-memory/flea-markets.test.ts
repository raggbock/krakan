import { describe, it, expect } from 'vitest'
import { createInMemoryFleaMarkets, createInMemoryMarketTables } from './flea-markets'
import type { StoredMarket } from './flea-markets'
import type { OpeningHourRuleView } from '../../types/domain'

function makeMarket(overrides: Partial<StoredMarket> = {}): StoredMarket {
  return {
    id: 'fm-test',
    name: 'Testloppis',
    description: 'En loppis för test',
    street: 'Testgatan 1',
    zipCode: '123 45',
    city: 'Teststad',
    country: 'SE',
    latitude: 59.33,
    longitude: 18.07,
    isPermanent: false,
    organizerId: 'org-1',
    autoAcceptBookings: false,
    publishedAt: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('createInMemoryFleaMarkets', () => {
  it('list returns only published, non-deleted markets', async () => {
    const repo = createInMemoryFleaMarkets([
      makeMarket({ id: 'fm-1', publishedAt: '2026-01-01T00:00:00Z', isPermanent: true }),
      makeMarket({ id: 'fm-2', publishedAt: null, isPermanent: true }),
      makeMarket({ id: 'fm-3', publishedAt: '2026-01-01T00:00:00Z', isDeleted: true, isPermanent: true }),
    ])
    const { items, count } = await repo.list()
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('fm-1')
    expect(count).toBe(1)
  })

  it('list with pagination returns the right page', async () => {
    const markets = Array.from({ length: 5 }, (_, i) =>
      makeMarket({ id: `fm-${i + 1}`, publishedAt: '2026-01-01T00:00:00Z', isPermanent: true }),
    )
    const repo = createInMemoryFleaMarkets(markets)
    const page1 = await repo.list({ page: 1, pageSize: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.count).toBe(5)
    const page2 = await repo.list({ page: 2, pageSize: 2 })
    expect(page2.items).toHaveLength(2)
    const page3 = await repo.list({ page: 3, pageSize: 2 })
    expect(page3.items).toHaveLength(1)
  })

  it('create-then-read returns what was stored', async () => {
    const repo = createInMemoryFleaMarkets()
    const { id } = await repo.create({
      name: 'Ny loppis',
      description: 'Beskrivning',
      address: {
        street: 'Gatan 1',
        zipCode: '111 22',
        city: 'Stockholm',
        country: 'SE',
        location: { latitude: 59.33, longitude: 18.07 },
      },
      isPermanent: false,
      organizerId: 'org-1',
      openingHours: [],
    })
    const details = await repo.details(id)
    expect(details.name).toBe('Ny loppis')
    expect(details.city).toBe('Stockholm')
    expect(details.publishedAt).toBeNull()
  })

  it('publish/unpublish toggles visibility in list', async () => {
    const repo = createInMemoryFleaMarkets([makeMarket({ id: 'fm-pub', publishedAt: null, isPermanent: true })])
    const before = await repo.list()
    expect(before.count).toBe(0)

    await repo.publish('fm-pub')
    const after = await repo.list()
    expect(after.count).toBe(1)

    await repo.unpublish('fm-pub')
    const final = await repo.list()
    expect(final.count).toBe(0)
  })

  it('soft-delete excludes market from list', async () => {
    const repo = createInMemoryFleaMarkets([
      makeMarket({ id: 'fm-del', publishedAt: '2026-01-01T00:00:00Z', isPermanent: true }),
    ])
    const before = await repo.list()
    expect(before.count).toBe(1)

    await repo.delete('fm-del')
    const after = await repo.list()
    expect(after.count).toBe(0)
  })

  it('listByOrganizer filters by organizerId and excludes deleted', async () => {
    const repo = createInMemoryFleaMarkets([
      makeMarket({ id: 'fm-a', organizerId: 'org-1', isPermanent: true }),
      makeMarket({ id: 'fm-b', organizerId: 'org-2', isPermanent: true }),
      makeMarket({ id: 'fm-c', organizerId: 'org-1', isDeleted: true, isPermanent: true }),
    ])
    const result = await repo.listByOrganizer('org-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('fm-a')
  })

  it('list excludes expired temporary market (no future date rules)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const repo = createInMemoryFleaMarkets([
      // Published temporary market with only a past date rule — should be hidden
      makeMarket({
        id: 'fm-expired',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: false,
        openingHourRules: [
          { id: 'r-1', type: 'date', anchorDate: yesterday, dayOfWeek: null, openTime: '10:00', closeTime: '16:00' },
        ],
      }),
      // Published temporary market with no rules at all — should be hidden
      makeMarket({
        id: 'fm-norules',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: false,
        openingHourRules: [],
      }),
      // Published temporary market with a future date rule — should be visible
      makeMarket({
        id: 'fm-future',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: false,
        openingHourRules: [
          { id: 'r-2', type: 'date', anchorDate: today, dayOfWeek: null, openTime: '10:00', closeTime: '16:00' },
        ],
      }),
    ])
    const { items, count } = await repo.list()
    expect(count).toBe(1)
    expect(items[0].id).toBe('fm-future')
  })

  it('list includes published permanent market regardless of rules', async () => {
    const repo = createInMemoryFleaMarkets([
      makeMarket({
        id: 'fm-perm',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: true,
        openingHourRules: [],
      }),
    ])
    const { items, count } = await repo.list()
    expect(count).toBe(1)
    expect(items[0].id).toBe('fm-perm')
  })

  it('listByOrganizer includes expired temporary market (organizer still sees it)', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const repo = createInMemoryFleaMarkets([
      makeMarket({
        id: 'fm-expired-org',
        organizerId: 'org-1',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: false,
        openingHourRules: [
          { id: 'r-3', type: 'date', anchorDate: yesterday, dayOfWeek: null, openTime: '10:00', closeTime: '16:00' },
        ],
      }),
    ])
    // list() should hide it
    const { count: publicCount } = await repo.list()
    expect(publicCount).toBe(0)

    // listByOrganizer() should still show it
    const orgMarkets = await repo.listByOrganizer('org-1')
    expect(orgMarkets).toHaveLength(1)
    expect(orgMarkets[0].id).toBe('fm-expired-org')
  })

  it('listByOrganizer sets isVisible=false for expired temporary market', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const repo = createInMemoryFleaMarkets([
      makeMarket({
        id: 'fm-hidden',
        organizerId: 'org-1',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: false,
        openingHourRules: [
          { id: 'r-h', type: 'date', anchorDate: yesterday, dayOfWeek: null, openTime: '10:00', closeTime: '16:00' },
        ],
      }),
      makeMarket({
        id: 'fm-permanent',
        organizerId: 'org-1',
        publishedAt: '2026-01-01T00:00:00Z',
        isPermanent: true,
        openingHourRules: [],
      }),
    ])
    const result = await repo.listByOrganizer('org-1')
    const hidden = result.find((m) => m.id === 'fm-hidden')
    const permanent = result.find((m) => m.id === 'fm-permanent')
    expect(hidden?.isVisible).toBe(false)
    expect(permanent?.isVisible).toBe(true)
  })
})

describe('createInMemoryMarketTables', () => {
  it('create-then-list returns the created table', async () => {
    const repo = createInMemoryMarketTables()
    const { id } = await repo.create({
      fleaMarketId: 'fm-1',
      label: 'Bord A',
      priceSek: 200,
    })
    const tables = await repo.list('fm-1')
    expect(tables).toHaveLength(1)
    expect(tables[0].id).toBe(id)
    expect(tables[0].label).toBe('Bord A')
  })

  it('list filters by fleaMarketId', async () => {
    const repo = createInMemoryMarketTables()
    await repo.create({ fleaMarketId: 'fm-1', label: 'Bord A', priceSek: 100 })
    await repo.create({ fleaMarketId: 'fm-2', label: 'Bord B', priceSek: 150 })
    const result = await repo.list('fm-1')
    expect(result).toHaveLength(1)
    expect(result[0].fleaMarketId).toBe('fm-1')
  })
})
