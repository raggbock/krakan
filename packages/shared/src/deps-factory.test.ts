import { describe, it, expect } from 'vitest'
import { makeInMemoryDeps } from './deps-factory'
import type { FleaMarket, OpeningHourRule } from './types'

const seedMarket = {
  id: 'fm-test-1',
  name: 'Testloppis',
  organizer_id: 'u1',
  is_permanent: true,
  published_at: '2024-01-01T00:00:00Z',
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  street: 'Storgatan 1',
  zip_code: '12345',
  city: 'Testköping',
  country: 'SE',
  latitude: 59.3,
  longitude: 18.0,
  auto_accept_bookings: false,
} as FleaMarket & { is_deleted: boolean; updated_at: string; opening_hour_rules?: OpeningHourRule[] }

describe('makeInMemoryDeps', () => {
  it('returns a Deps object with markets and marketTables', () => {
    const deps = makeInMemoryDeps()
    expect(typeof deps.markets.list).toBe('function')
    expect(typeof deps.marketTables.list).toBe('function')
  })

  it('markets.list returns seeded markets', async () => {
    const deps = makeInMemoryDeps([seedMarket])
    const { items, count } = await deps.markets.list()
    expect(count).toBe(1)
    expect(items[0].name).toBe('Testloppis')
  })

  it('markets.details returns seeded market', async () => {
    const deps = makeInMemoryDeps([seedMarket])
    const details = await deps.markets.details('fm-test-1')
    expect(details.id).toBe('fm-test-1')
  })

  it('markets.listByOrganizer filters by organizer_id', async () => {
    const deps = makeInMemoryDeps([seedMarket])
    const result = await deps.markets.listByOrganizer('u1')
    expect(result).toHaveLength(1)
    const empty = await deps.markets.listByOrganizer('other')
    expect(empty).toHaveLength(0)
  })

})
