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

type FakeStore = Map<string, { user_id: string; flea_market_id: string }>

function makeSupabaseClient(store: FakeStore) {
  return {
    from(_table: string) {
      type Mode = 'select' | 'delete' | 'upsert'
      let mode: Mode = 'select'
      const filters: Record<string, string> = {}

      function resolve(): { data: unknown; error: null } {
        if (mode === 'delete') {
          const uid = filters['user_id']
          const mid = filters['flea_market_id']
          if (uid && mid) store.delete(`${uid}::${mid}`)
          return { data: null, error: null }
        }
        if (mode === 'select') {
          const uid = filters['user_id']
          const mid = filters['flea_market_id']
          if (uid && mid) {
            const k = `${uid}::${mid}`
            return { data: store.get(k) ?? null, error: null }
          }
        }
        return { data: null, error: null }
      }

      const builder: Record<string, unknown> = {
        upsert(data: { user_id: string; flea_market_id: string }, _opts?: unknown) {
          mode = 'upsert'
          const k = `${data.user_id}::${data.flea_market_id}`
          store.set(k, data)
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

    it('follows are scoped per user', async () => {
      await repo.followMarket('u1', 'fm1')
      expect(await repo.isFollowingMarket('u2', 'fm1')).toBe(false)
    })

    it('follows are scoped per market', async () => {
      await repo.followMarket('u1', 'fm1')
      expect(await repo.isFollowingMarket('u1', 'fm2')).toBe(false)
    })
  })
}

runParitySuite('InMemoryFollowRepo', () => createInMemoryFollowRepo())

runParitySuite('SupabaseFollowRepo', () => {
  const store: FakeStore = new Map()
  return createSupabaseFollowRepo(makeSupabaseClient(store) as never)
})
