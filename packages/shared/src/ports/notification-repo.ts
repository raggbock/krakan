/**
 * NotificationRepository — port for reading and managing in-app inbox notifications.
 *
 * Issue #155: In-app inbox: nav bell + dropdown + /profil/notiser
 *
 * Only inbox deliveries (channel='inbox') are surfaced here.
 * Email digest operations belong to the digest edge function (#156).
 */

export type NotificationEventType =
  | 'market.published'
  | 'market.updated'
  | 'market.new_date'
  | 'block_sale.published'

/**
 * A fully-rendered inbox row — everything needed to display a notification
 * without an extra fetch. The Supabase adapter joins through
 * notification_events → flea_markets for market/city display data.
 */
export type NotificationInboxRow = {
  /** The event id (not the delivery id) — what the user is notified about. */
  eventId: string
  eventType: NotificationEventType
  fleaMarketId: string | null
  marketName: string | null
  marketSlug: string | null
  citySlug: string | null
  cityCanonicalName: string | null
  payload: Record<string, unknown>
  occurredAt: string
  readAt: string | null
}

export interface NotificationRepository {
  /**
   * Returns inbox notifications for the user, most recent first.
   * Only includes deliveries where channel='inbox'.
   * Enforces a 30-day cutoff — events older than 30 days are excluded.
   */
  listInbox(
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<NotificationInboxRow[]>

  /**
   * Count of unread inbox notifications (read_at IS NULL, channel='inbox').
   */
  unreadCount(userId: string): Promise<number>

  /**
   * Mark a single notification as read by (userId, eventId).
   * Idempotent — safe to call if already read.
   */
  markRead(userId: string, eventId: string): Promise<void>

  /**
   * Bulk mark all inbox notifications as read for the user.
   * Idempotent — safe to call when there is nothing to mark.
   */
  markAllRead(userId: string): Promise<void>
}
