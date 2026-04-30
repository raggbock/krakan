import { createInMemoryAuth, createInMemoryServerData } from '@fyndstigen/shared'

describe('createInMemoryAuth', () => {
  it('starts with no user by default', async () => {
    const auth = createInMemoryAuth()
    const { user } = await auth.getSession()
    expect(user).toBeNull()
  })

  it('starts with initial user when provided', async () => {
    const auth = createInMemoryAuth({ id: 'u1', email: 'a@b.se' })
    const { user } = await auth.getSession()
    expect(user).toEqual({ id: 'u1', email: 'a@b.se' })
  })

  it('signIn sets user and notifies listeners', async () => {
    const auth = createInMemoryAuth()
    const listener = vi.fn()
    auth.onAuthStateChange(listener)

    await auth.signIn('test@test.se', 'pass')

    const { user } = await auth.getSession()
    expect(user?.email).toBe('test@test.se')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@test.se' }))
  })

  it('signOut clears user and notifies listeners', async () => {
    const auth = createInMemoryAuth({ id: 'u1', email: 'a@b.se' })
    const listener = vi.fn()
    auth.onAuthStateChange(listener)

    await auth.signOut()

    const { user } = await auth.getSession()
    expect(user).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
  })

  it('unsubscribe stops notifications', async () => {
    const auth = createInMemoryAuth()
    const listener = vi.fn()
    const unsub = auth.onAuthStateChange(listener)

    unsub()
    await auth.signIn('x@y.se', 'pass')

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('createInMemoryServerData', () => {
  const seed = {
    markets: [
      {
        id: 'm1',
        updatedAt: '2026-01-01',
        name: 'Stortorget',
        description: 'En loppis',
        city: 'Stockholm',
        street: 'Storgatan 1',
        zip_code: '111 22',
        latitude: 59.33,
        longitude: 18.07,
        is_permanent: true,
        organizer_subscription_tier: 1,
        opening_hour_rules: [
          { type: 'weekly', day_of_week: 6, anchor_date: null, open_time: '10:00', close_time: '16:00' },
        ],
        price_range: { min_sek: 100, max_sek: 300 },
        image_url: 'https://example.com/storage/v1/object/public/flea-market-images/test.jpg',
      },
    ],
    routes: [
      {
        id: 'r1',
        updatedAt: '2026-02-01',
        name: 'Södermalm-rundan',
        description: 'Tre loppisar',
        stopCount: 3,
        stops: [],
      },
    ],
  }

  it('getMarketMeta returns matching market', async () => {
    const server = createInMemoryServerData(seed)
    const market = await server.getMarketMeta('m1')
    expect(market?.name).toBe('Stortorget')
  })

  it('getMarketMeta returns null for unknown id', async () => {
    const server = createInMemoryServerData(seed)
    expect(await server.getMarketMeta('nope')).toBeNull()
  })

  it('getMarketMeta returns SEO fields for premium market', async () => {
    const server = createInMemoryServerData(seed)
    const market = await server.getMarketMeta('m1')
    expect(market?.organizer_subscription_tier).toBe(1)
    expect(market?.opening_hour_rules).toHaveLength(1)
    expect(market?.opening_hour_rules[0].type).toBe('weekly')
    expect(market?.price_range).toEqual({ min_sek: 100, max_sek: 300 })
    expect(market?.image_url).toContain('test.jpg')
  })

  it('getRouteMeta returns matching route', async () => {
    const server = createInMemoryServerData(seed)
    const route = await server.getRouteMeta('r1')
    expect(route?.name).toBe('Södermalm-rundan')
    expect(route?.stopCount).toBe(3)
  })

  it('listPublishedMarketIds returns all seeded', async () => {
    const server = createInMemoryServerData(seed)
    const ids = await server.listPublishedMarketIds()
    expect(ids).toEqual([{ id: 'm1', slug: null, updatedAt: '2026-01-01' }])
  })

  it('listPublishedRouteIds returns all seeded', async () => {
    const server = createInMemoryServerData(seed)
    const ids = await server.listPublishedRouteIds()
    expect(ids).toEqual([{ id: 'r1', updatedAt: '2026-02-01' }])
  })

  it('empty seed returns empty results', async () => {
    const server = createInMemoryServerData()
    expect(await server.listPublishedMarketIds()).toEqual([])
    expect(await server.getMarketMeta('any')).toBeNull()
  })
})
