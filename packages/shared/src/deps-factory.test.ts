import { describe, it, expect } from 'vitest'
import { makeInMemoryDeps, createE2EInMemoryDeps } from './deps-factory'
import type { StoredMarket } from './adapters/in-memory/flea-markets'

const seedMarket: StoredMarket = {
  id: 'fm-test-1',
  name: 'Testloppis',
  organizerId: 'u1',
  isPermanent: true,
  publishedAt: '2024-01-01T00:00:00Z',
  isDeleted: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  street: 'Storgatan 1',
  zipCode: '12345',
  city: 'Testköping',
  country: 'SE',
  latitude: 59.3,
  longitude: 18.0,
  autoAcceptBookings: false,
  description: '',
}

const seedRoute = {
  id: 'rt-test-1',
  name: 'Testrunda',
  description: null,
  createdBy: 'u1',
  startLatitude: null,
  startLongitude: null,
  plannedDate: null,
  isPublished: false,
  publishedAt: null,
  isDeleted: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
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
    const seedProfile: import('./types').UserProfileView = {
      id: 'u1',
      firstName: 'Anna',
      lastName: 'Svensson',
      phoneNumber: null,
      userType: 0,
    }
    const deps = makeInMemoryDeps([], [], [seedProfile])
    const profile = await deps.profiles.get('u1')
    expect(profile.firstName).toBe('Anna')
  })

})

describe('createE2EInMemoryDeps', () => {
  it('starts empty and grows after control.markets.seed()', async () => {
    const { deps, control } = createE2EInMemoryDeps()
    expect((await deps.markets.list()).count).toBe(0)

    control.markets.seed([seedMarket])
    expect((await deps.markets.list()).count).toBe(1)
    expect((await deps.markets.details('fm-test-1')).name).toBe('Testloppis')
  })

  it('control.markets.reset() clears the store', async () => {
    const { deps, control } = createE2EInMemoryDeps()
    control.markets.seed([seedMarket])
    control.markets.reset()
    expect((await deps.markets.list()).count).toBe(0)
  })

  it('re-seeding replaces previous data rather than appending', async () => {
    const { deps, control } = createE2EInMemoryDeps()
    control.markets.seed([seedMarket])
    control.markets.seed([{ ...seedMarket, id: 'fm-test-2', name: 'Andra loppis' }])
    const { items, count } = await deps.markets.list()
    expect(count).toBe(1)
    expect(items[0].id).toBe('fm-test-2')
  })
})
