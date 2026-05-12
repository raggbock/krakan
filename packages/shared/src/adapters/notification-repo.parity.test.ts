/**
 * NotificationRepository parity suite.
 *
 * Runs the same behavioural assertions against both the in-memory and the
 * Supabase adapter. The Supabase adapter is exercised against a fake client
 * (no real network) — this verifies the adapter's query-builder wiring.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryNotificationRepo } from './in-memory/notification-repo'
import { createSupabaseNotificationRepo } from './supabase/notification-repo'
import type { NotificationRepository, NotificationInboxRow } from '../ports/notification-repo'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<NotificationInboxRow> & { eventId: string }): NotificationInboxRow {
  return {
    eventType: 'market.published',
    fleaMarketId: 'fm1',
    marketName: 'Testloppis',
    marketSlug: 'testloppis',
    citySlug: 'stockholm',
    cityCanonicalName: 'Stockholm',
    payload: {},
    occurredAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  }
}

// ─── Supabase fake client ────────────────────────────────────────────────────

/**
 * Minimal fake Supabase client that backs the NotificationRepository adapter.
 *
 * We store deliveries in a flat list and emulate the query-builder chain
 * well enough to cover the adapter's access patterns:
 *   - listInbox → select with eq filters + range
 *   - unreadCount → select with count: exact + head: true
 *   - markRead / markAllRead → update with eq filters
 */
type FakeDelivery = {
  user_id: string
  event_id: string
  channel: string
  read_at: string | null
  notification_events: {
    id: string
    type: string
    flea_market_id: string | null
    city_slug: string | null
    payload: Record<string, unknown>
    occurred_at: string
    flea_markets: { name: string | null; slug: string | null; city: string | null } | null
  }
}

function makeSupabaseClient(deliveries: FakeDelivery[]) {
  return {
    rpc(fn: string, args: { p_user_id?: string; p_event_id?: string }) {
      // Mirrors the production SECURITY DEFINER RPCs (auth.uid() check
      // → update read_at for caller's rows).
      if (fn === 'mark_notification_read') {
        for (const d of deliveries) {
          if (
            d.user_id === args.p_user_id &&
            d.event_id === args.p_event_id &&
            d.channel === 'inbox' &&
            d.read_at === null
          ) {
            d.read_at = new Date().toISOString()
          }
        }
        return Promise.resolve({ data: null, error: null })
      }
      if (fn === 'mark_all_notifications_read') {
        let count = 0
        for (const d of deliveries) {
          if (d.user_id === args.p_user_id && d.channel === 'inbox' && d.read_at === null) {
            d.read_at = new Date().toISOString()
            count += 1
          }
        }
        return Promise.resolve({ data: count, error: null })
      }
      return Promise.resolve({ data: null, error: { message: `Unknown rpc: ${fn}` } })
    },

    from(table: string) {
      if (table !== 'notification_deliveries') {
        throw new Error(`Unexpected table: ${table}`)
      }

      let isCountHead = false
      let isUpdate = false
      let isSelect = false
      let selectArg = ''
      const eqFilters: Record<string, unknown> = {}
      const isNullFilters: string[] = []
      const gteFilters: Record<string, string> = {}
      let rangeFrom = 0
      let rangeTo = 999
      let updatePayload: Record<string, unknown> = {}

      function matchesFilters(d: FakeDelivery): boolean {
        // eq filters
        for (const [k, v] of Object.entries(eqFilters)) {
          if (k === 'user_id' && d.user_id !== v) return false
          if (k === 'channel' && d.channel !== v) return false
          if (k === 'event_id' && d.event_id !== v) return false
        }
        // is null filters
        for (const k of isNullFilters) {
          if (k === 'read_at' && d.read_at !== null) return false
        }
        // gte filters (on nested occurred_at)
        for (const [k, v] of Object.entries(gteFilters)) {
          if (k.includes('occurred_at')) {
            if (new Date(d.notification_events.occurred_at) < new Date(v)) return false
          }
        }
        return true
      }

      function resolve(): { data: unknown; error: null; count?: number } {
        if (isUpdate) {
          const now = updatePayload['read_at'] as string
          let affected = 0
          for (const d of deliveries) {
            if (matchesFilters(d)) {
              d.read_at = now
              affected++
            }
          }
          return { data: null, error: null }
        }

        const matched = deliveries.filter(matchesFilters)

        if (isCountHead) {
          return { data: null, error: null, count: matched.length }
        }

        // Sort by occurred_at descending (order call is ignored in fake)
        const sorted = matched.sort(
          (a, b) =>
            new Date(b.notification_events.occurred_at).getTime() -
            new Date(a.notification_events.occurred_at).getTime(),
        )

        const paged = sorted.slice(rangeFrom, rangeTo + 1)
        return { data: paged, error: null }
      }

      const builder: Record<string, unknown> = {
        select(arg: string, opts?: { count?: string; head?: boolean }) {
          isSelect = true
          selectArg = arg
          if (opts?.head) isCountHead = true
          return builder
        },

        update(payload: Record<string, unknown>) {
          isUpdate = true
          updatePayload = payload
          return builder
        },

        eq(field: string, value: unknown) {
          eqFilters[field] = value
          return builder
        },

        is(field: string, value: null) {
          if (value === null) isNullFilters.push(field)
          return builder
        },

        gte(field: string, value: string) {
          gteFilters[field] = value
          return builder
        },

        order(_field: string, _opts?: unknown) {
          return builder
        },

        range(from: number, to: number) {
          rangeFrom = from
          rangeTo = to
          return builder
        },

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

function makeDelivery(
  userId: string,
  row: NotificationInboxRow,
  overrides: Partial<FakeDelivery> = {},
): FakeDelivery {
  return {
    user_id: userId,
    event_id: row.eventId,
    channel: 'inbox',
    read_at: row.readAt,
    notification_events: {
      id: row.eventId,
      type: row.eventType,
      flea_market_id: row.fleaMarketId,
      city_slug: row.citySlug,
      payload: row.payload,
      occurred_at: row.occurredAt,
      flea_markets: row.marketName
        ? { name: row.marketName, slug: row.marketSlug, city: row.cityCanonicalName }
        : null,
    },
    ...overrides,
  }
}

// ─── Parity suite ────────────────────────────────────────────────────────────

function runParitySuite(
  name: string,
  factory: () => {
    repo: NotificationRepository
    seed: (userId: string, row: NotificationInboxRow) => void
  },
) {
  describe(name, () => {
    let repo: NotificationRepository
    let seed: (userId: string, row: NotificationInboxRow) => void

    beforeEach(() => {
      const created = factory()
      repo = created.repo
      seed = created.seed
    })

    it('listInbox returns most recent first', async () => {
      const older = makeRow({
        eventId: 'ev-old',
        occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      })
      const newer = makeRow({
        eventId: 'ev-new',
        occurredAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      })
      seed('u1', older)
      seed('u1', newer)

      const rows = await repo.listInbox('u1')
      expect(rows[0].eventId).toBe('ev-new')
      expect(rows[1].eventId).toBe('ev-old')
    })

    it('listInbox respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        seed(
          'u1',
          makeRow({
            eventId: `ev-${i}`,
            occurredAt: new Date(Date.now() - i * 60 * 1000).toISOString(),
          }),
        )
      }
      const rows = await repo.listInbox('u1', { limit: 3 })
      expect(rows).toHaveLength(3)
    })

    it('listInbox respects offset', async () => {
      // Seed 3 rows with deterministic ordering
      const rows = [
        makeRow({ eventId: 'ev-a', occurredAt: new Date(Date.now() - 1000).toISOString() }),
        makeRow({ eventId: 'ev-b', occurredAt: new Date(Date.now() - 2000).toISOString() }),
        makeRow({ eventId: 'ev-c', occurredAt: new Date(Date.now() - 3000).toISOString() }),
      ]
      for (const r of rows) seed('u1', r)

      const page2 = await repo.listInbox('u1', { limit: 2, offset: 2 })
      expect(page2).toHaveLength(1)
      expect(page2[0].eventId).toBe('ev-c')
    })

    it('listInbox does not return rows older than 30 days', async () => {
      const stale = makeRow({
        eventId: 'ev-stale',
        // 31 days ago
        occurredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      })
      seed('u1', stale)
      const rows = await repo.listInbox('u1')
      expect(rows).toHaveLength(0)
    })

    it('listInbox is scoped per user', async () => {
      seed('u1', makeRow({ eventId: 'ev1' }))
      seed('u2', makeRow({ eventId: 'ev2' }))
      const u1Rows = await repo.listInbox('u1')
      expect(u1Rows.every((r) => r.eventId === 'ev1')).toBe(true)
    })

    it('unreadCount only counts unread rows', async () => {
      seed('u1', makeRow({ eventId: 'ev-unread', readAt: null }))
      seed('u1', makeRow({ eventId: 'ev-read', readAt: new Date().toISOString() }))
      expect(await repo.unreadCount('u1')).toBe(1)
    })

    it('unreadCount returns 0 when inbox is empty', async () => {
      expect(await repo.unreadCount('u1')).toBe(0)
    })

    it('unreadCount does not count rows older than 30 days', async () => {
      seed('u1', makeRow({
        eventId: 'ev-stale',
        occurredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      }))
      expect(await repo.unreadCount('u1')).toBe(0)
    })

    it('markRead sets read_at on the matching row', async () => {
      seed('u1', makeRow({ eventId: 'ev1', readAt: null }))
      await repo.markRead('u1', 'ev1')
      const rows = await repo.listInbox('u1')
      expect(rows[0].readAt).not.toBeNull()
    })

    it('markRead is idempotent (no error if already read)', async () => {
      seed('u1', makeRow({ eventId: 'ev1', readAt: new Date().toISOString() }))
      await expect(repo.markRead('u1', 'ev1')).resolves.not.toThrow()
    })

    it('markRead only affects the targeted event', async () => {
      seed('u1', makeRow({ eventId: 'ev1', readAt: null }))
      seed('u1', makeRow({ eventId: 'ev2', readAt: null }))
      await repo.markRead('u1', 'ev1')

      const rows = await repo.listInbox('u1')
      const ev1 = rows.find((r) => r.eventId === 'ev1')!
      const ev2 = rows.find((r) => r.eventId === 'ev2')!
      expect(ev1.readAt).not.toBeNull()
      expect(ev2.readAt).toBeNull()
    })

    it('markAllRead clears all unread rows', async () => {
      seed('u1', makeRow({ eventId: 'ev1', readAt: null }))
      seed('u1', makeRow({ eventId: 'ev2', readAt: null }))
      await repo.markAllRead('u1')
      expect(await repo.unreadCount('u1')).toBe(0)
    })

    it('markAllRead is idempotent when inbox is already all-read', async () => {
      seed('u1', makeRow({ eventId: 'ev1', readAt: new Date().toISOString() }))
      await expect(repo.markAllRead('u1')).resolves.not.toThrow()
    })

    it('markAllRead does not affect other users', async () => {
      seed('u1', makeRow({ eventId: 'ev1', readAt: null }))
      seed('u2', makeRow({ eventId: 'ev2', readAt: null }))
      await repo.markAllRead('u1')
      expect(await repo.unreadCount('u2')).toBe(1)
    })
  })
}

// ─── Run against both adapters ───────────────────────────────────────────────

runParitySuite('InMemoryNotificationRepo', () => {
  const repo = createInMemoryNotificationRepo()
  return { repo, seed: (userId, row) => repo._seed(userId, row) }
})

runParitySuite('SupabaseNotificationRepo', () => {
  const deliveries: FakeDelivery[] = []
  const repo = createSupabaseNotificationRepo(makeSupabaseClient(deliveries) as never)
  return {
    repo,
    seed: (userId, row) => deliveries.push(makeDelivery(userId, row)),
  }
})
