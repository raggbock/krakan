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

const seedRoute = {
  id: 'rt-test-1',
  name: 'Testrunda',
  description: null,
  created_by: 'u1',
  start_latitude: null,
  start_longitude: null,
  planned_date: null,
  is_published: false,
  published_at: null,
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  stops: [],
}

describe('makeInMemoryDeps', () => {
  it('returns a Deps object with markets, marketTables, routes, and profiles', () => {
    const deps = makeInMemoryDeps()
    expect(typeof deps.markets.list).toBe('function')
    expect(typeof deps.marketTables.list).toBe('function')
    expect(typeof deps.routes.get).toBe('function')
    expect(typeof deps.profiles.get).toBe('function')
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

  it('routes.get returns seeded route', async () => {
    const deps = makeInMemoryDeps([], [seedRoute])
    const route = await deps.routes.get('rt-test-1')
    expect(route.name).toBe('Testrunda')
  })

  it('routes.listByUser returns routes for user', async () => {
    const deps = makeInMemoryDeps([], [seedRoute])
    const routes = await deps.routes.listByUser('u1')
    expect(routes).toHaveLength(1)
    expect(routes[0].name).toBe('Testrunda')
    const empty = await deps.routes.listByUser('other')
    expect(empty).toHaveLength(0)
  })

  it('routes.create adds a new route', async () => {
    const deps = makeInMemoryDeps()
    const { id } = await deps.routes.create({
      name: 'Ny runda',
      createdBy: 'u2',
      stops: [],
    })
    expect(id).toBeTruthy()
    const route = await deps.routes.get(id)
    expect(route.name).toBe('Ny runda')
  })

  it('profiles.get returns seeded profile', async () => {
    const seedProfile = {
      id: 'u1',
      first_name: 'Anna',
      last_name: 'Svensson',
      phone_number: null,
      user_type: 0,
    } as import('./types').UserProfile
    const deps = makeInMemoryDeps([], [], [seedProfile])
    const profile = await deps.profiles.get('u1')
    expect(profile.first_name).toBe('Anna')
  })

})
