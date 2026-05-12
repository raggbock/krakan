/**
 * FollowRepository parity suite.
 *
 * Runs the same behavioural assertions against both the in-memory and the
 * Supabase adapter.  The Supabase adapter is exercised against a fake client
 * (no real network) — this verifies the adapter's query-builder wiring.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryFollowRepo } from './in-memory/follow-repo'
import { createSupabaseFollowRepo } from './supabase/follow-repo'
import type { FollowRepository } from '../ports/follow-repo'

// ─── Supabase fake client ────────────────────────────────────────────────────

type MarketRow = { user_id: string; flea_market_id: string }
type CityRow = { user_id: string; city_slug: string }
type FakeStores = {
  markets: Map<string, MarketRow>
  cities: Map<string, CityRow>
}

function makeSupabaseClient(stores: FakeStores) {
  return {
    from(table: string) {
      type Mode = 'select' | 'delete' | 'upsert'
      let mode: Mode = 'select'
      const filters: Record<string, string> = {}

      const isCity = table === 'user_city_follows'
      const store = isCity ? stores.cities : stores.markets

      function compositeKey(): string {
        const uid = filters['user_id']
        if (isCity) {
          return `${uid}::${filters['city_slug']}`
        }
        return `${uid}::${filters['flea_market_id']}`
      }

      function resolve(): { data: unknown; error: null } {
        if (mode === 'delete') {
          store.delete(compositeKey())
          return { data: null, error: null }
        }
        if (mode === 'select') {
          const k = compositeKey()
          return { data: (store as Map<string, unknown>).get(k) ?? null, error: null }
        }
        return { data: null, error: null }
      }

      const builder: Record<string, unknown> = {
        upsert(data: MarketRow | CityRow, _opts?: unknown) {
          mode = 'upsert'
          if (isCity) {
            const d = data as CityRow
            const k = `${d.user_id}::${d.city_slug}`
            stores.cities.set(k, d)
          } else {
            const d = data as MarketRow
            const k = `${d.user_id}::${d.flea_market_id}`
            stores.markets.set(k, d)
          }
          return Promise.resolve({ data: null, error: null })
        },

        delete() {
          mode = 'delete'
          return builder
        },

        select(_cols?: string) {
          mode = 'select'
          return builder
        },

        eq(field: string, value: string) {
          filters[field] = value
          return builder
        },

        maybeSingle() {
          return Promise.resolve(resolve())
        },

        // Make the builder itself thenable so `await delete().eq().eq()` works.
        then(
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(resolve()).then(onFulfilled, onRejected)
        },
      }
      return builder
    },
  }
}

// ─── Parity suite ────────────────────────────────────────────────────────────

function runParitySuite(name: string, factory: () => FollowRepository) {
  describe(name, () => {
    let repo: FollowRepository

    beforeEach(() => {
      repo = factory()
    })

    // ── Market follows ──────────────────────────────────────────────────────

    it('isFollowingMarket returns false when not following', async () => {
      const result = await repo.isFollowingMarket('u1', 'fm1')
      expect(result).toBe(false)
    })

    it('followMarket + isFollowingMarket returns true', async () => {
      await repo.followMarket('u1', 'fm1')
      expect(await repo.isFollowingMarket('u1', 'fm1')).toBe(true)
    })

    it('unfollowMarket + isFollowingMarket returns false', async () => {
      await repo.followMarket('u1', 'fm1')
      await repo.unfollowMarket('u1', 'fm1')
      expect(await repo.isFollowingMarket('u1', 'fm1')).toBe(false)
    })

    it('double-follow is idempotent (no error)', async () => {
      await expect(async () => {
        await repo.followMarket('u1', 'fm1')
        await repo.followMarket('u1', 'fm1')
      }).not.toThrow()
      expect(await repo.isFollowingMarket('u1', 'fm1')).toBe(true)
    })

    it('unfollow without prior follow is idempotent (no error)', async () => {
      await expect(async () => {
        await repo.unfollowMarket('u1', 'fm-nonexistent')
      }).not.toThrow()
      expect(await repo.isFollowingMarket('u1', 'fm-nonexistent')).toBe(false)
    })

    it('market follows are scoped per user', async () => {
      await repo.followMarket('u1', 'fm1')
      expect(await repo.isFollowingMarket('u2', 'fm1')).toBe(false)
    })

    it('market follows are scoped per market', async () => {
      await repo.followMarket('u1', 'fm1')
      expect(await repo.isFollowingMarket('u1', 'fm2')).toBe(false)
    })

    // ── City follows ────────────────────────────────────────────────────────

    it('isFollowingCity returns false when not following', async () => {
      const result = await repo.isFollowingCity('u1', 'stockholm')
      expect(result).toBe(false)
    })

    it('followCity + isFollowingCity returns true', async () => {
      await repo.followCity('u1', 'stockholm')
      expect(await repo.isFollowingCity('u1', 'stockholm')).toBe(true)
    })

    it('unfollowCity + isFollowingCity returns false', async () => {
      await repo.followCity('u1', 'stockholm')
      await repo.unfollowCity('u1', 'stockholm')
      expect(await repo.isFollowingCity('u1', 'stockholm')).toBe(false)
    })

    it('double-followCity is idempotent (no error)', async () => {
      await expect(async () => {
        await repo.followCity('u1', 'stockholm')
        await repo.followCity('u1', 'stockholm')
      }).not.toThrow()
      expect(await repo.isFollowingCity('u1', 'stockholm')).toBe(true)
    })

    it('unfollowCity without prior follow is idempotent (no error)', async () => {
      await expect(async () => {
        await repo.unfollowCity('u1', 'nonexistent-city')
      }).not.toThrow()
      expect(await repo.isFollowingCity('u1', 'nonexistent-city')).toBe(false)
    })

    it('city follows are scoped per user', async () => {
      await repo.followCity('u1', 'stockholm')
      expect(await repo.isFollowingCity('u2', 'stockholm')).toBe(false)
    })

    it('city follows are scoped per city', async () => {
      await repo.followCity('u1', 'stockholm')
      expect(await repo.isFollowingCity('u1', 'goteborg')).toBe(false)
    })

    it('city follows do not bleed into market follows', async () => {
      await repo.followCity('u1', 'stockholm')
      // 'stockholm' as a market ID should not be considered followed
      expect(await repo.isFollowingMarket('u1', 'stockholm')).toBe(false)
    })
  })
}

runParitySuite('InMemoryFollowRepo', () => createInMemoryFollowRepo())

runParitySuite('SupabaseFollowRepo', () => {
  const stores: FakeStores = { markets: new Map(), cities: new Map() }
  return createSupabaseFollowRepo(makeSupabaseClient(stores) as never)
})
