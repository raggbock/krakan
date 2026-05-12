/**
 * In-memory adapter for NotificationRepository — for use in tests and E2E.
 *
 * Stores NotificationInboxRow objects directly (no join needed).
 * The 30-day cutoff is enforced at query time, matching the Supabase adapter.
 */
import type { NotificationRepository, NotificationInboxRow } from '../../ports/notification-repo'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export type InMemoryNotificationRepo = NotificationRepository & {
  /**
   * Seed a delivery row directly. Used by E2E tests to plant notifications
   * without going through the DB trigger fan-out.
   */
  _seed(userId: string, row: NotificationInboxRow): void
}

export function createInMemoryNotificationRepo(): InMemoryNotificationRepo {
  // Map of userId → Map of eventId → NotificationInboxRow
  const store = new Map<string, Map<string, NotificationInboxRow>>()

  function getOrCreate(userId: string): Map<string, NotificationInboxRow> {
    if (!store.has(userId)) store.set(userId, new Map())
    return store.get(userId)!
  }

  function withinCutoff(row: NotificationInboxRow): boolean {
    const age = Date.now() - new Date(row.occurredAt).getTime()
    return age <= THIRTY_DAYS_MS
  }

  return {
    async listInbox(userId, opts = {}) {
      const { limit = 50, offset = 0 } = opts
      const rows = Array.from(getOrCreate(userId).values())
        .filter(withinCutoff)
        .sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        )
      return rows.slice(offset, offset + limit)
    },

    async unreadCount(userId) {
      const rows = Array.from(getOrCreate(userId).values())
      return rows.filter((r) => r.readAt === null && withinCutoff(r)).length
    },

    async markRead(userId, eventId) {
      const userStore = getOrCreate(userId)
      const row = userStore.get(eventId)
      if (row && row.readAt === null) {
        userStore.set(eventId, { ...row, readAt: new Date().toISOString() })
      }
    },

    async markAllRead(userId) {
      const userStore = getOrCreate(userId)
      const now = new Date().toISOString()
      for (const [eventId, row] of userStore) {
        if (row.readAt === null) {
          userStore.set(eventId, { ...row, readAt: now })
        }
      }
    },

    _seed(userId, row) {
      getOrCreate(userId).set(row.eventId, row)
    },
  }
}
