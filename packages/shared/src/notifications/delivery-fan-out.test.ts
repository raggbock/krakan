import { describe, it, expect } from 'vitest'
import { fanOutDeliveries } from './delivery-fan-out'
import type { NotificationEvent, Followers } from './delivery-fan-out'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides?: Partial<NotificationEvent>): NotificationEvent {
  return {
    id: 'event-1',
    type: 'market.updated',
    fleaMarketId: 'market-1',
    citySlug: 'stockholm',
    payload: {},
    occurredAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fanOutDeliveries', () => {
  it('3 market followers, 0 city followers → 3 rows with reason=market', () => {
    const event = makeEvent()
    const followers: Followers = {
      marketFollowers: ['user-1', 'user-2', 'user-3'],
      cityFollowers: [],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result).toHaveLength(3)
    expect(result.every((r) => r.reason === 'market')).toBe(true)
    expect(result.every((r) => r.eventId === 'event-1')).toBe(true)
    expect(result.map((r) => r.userId).sort()).toEqual(['user-1', 'user-2', 'user-3'])
  })

  it('0 market followers, 2 city followers → 2 rows with reason=city', () => {
    const event = makeEvent()
    const followers: Followers = {
      marketFollowers: [],
      cityFollowers: ['user-4', 'user-5'],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.reason === 'city')).toBe(true)
    expect(result.map((r) => r.userId).sort()).toEqual(['user-4', 'user-5'])
  })

  it('same user in both lists → 1 row with reason=market (dedup)', () => {
    const event = makeEvent()
    const followers: Followers = {
      marketFollowers: ['user-1'],
      cityFollowers: ['user-1'],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ userId: 'user-1', reason: 'market' })
  })

  it('empty followers → empty output', () => {
    const event = makeEvent()
    const followers: Followers = {
      marketFollowers: [],
      cityFollowers: [],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result).toHaveLength(0)
  })

  it('mixed: 2 market-only, 1 dedup user, 1 city-only → 4 rows with correct reasons', () => {
    // market followers: [A, B, C_dedup]
    // city  followers: [C_dedup, D]
    // Expected:
    //   A → reason=market
    //   B → reason=market
    //   C → reason=market (dedup wins)
    //   D → reason=city
    const event = makeEvent()
    const followers: Followers = {
      marketFollowers: ['user-A', 'user-B', 'user-C'],
      cityFollowers: ['user-C', 'user-D'],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result).toHaveLength(4)

    const byUser = Object.fromEntries(result.map((r) => [r.userId, r.reason]))
    expect(byUser['user-A']).toBe('market')
    expect(byUser['user-B']).toBe('market')
    expect(byUser['user-C']).toBe('market') // dedup: market wins
    expect(byUser['user-D']).toBe('city')
  })

  it('block_sale event with city followers only → rows with reason=city', () => {
    const event = makeEvent({
      id: 'event-bs-1',
      type: 'block_sale.published',
      fleaMarketId: null,  // block sales have no flea_market_id
      citySlug: 'goteborg',
    })
    const followers: Followers = {
      marketFollowers: [],
      cityFollowers: ['user-X', 'user-Y'],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.reason === 'city')).toBe(true)
    expect(result.every((r) => r.eventId === 'event-bs-1')).toBe(true)
  })

  it('all rows reference the correct event id', () => {
    const event = makeEvent({ id: 'specific-event-id' })
    const followers: Followers = {
      marketFollowers: ['user-1'],
      cityFollowers: ['user-2'],
    }

    const result = fanOutDeliveries(event, followers)

    expect(result.every((r) => r.eventId === 'specific-event-id')).toBe(true)
  })
})
