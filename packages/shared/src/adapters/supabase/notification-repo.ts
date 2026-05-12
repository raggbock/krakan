/**
 * Supabase adapter for NotificationRepository.
 *
 * Queries notification_deliveries (channel='inbox') joined with
 * notification_events and flea_markets for display data.
 *
 * The 30-day cutoff is enforced at the DB layer via an `occurred_at` filter.
 * RLS ensures users only see their own deliveries.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationRepository, NotificationInboxRow } from '../../ports/notification-repo'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function cutoffIso(): string {
  return new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
}

/**
 * Shape returned by the joined Supabase query.
 */
type RawDeliveryRow = {
  read_at: string | null
  notification_events: {
    id: string
    type: string
    flea_market_id: string | null
    city_slug: string | null
    payload: Record<string, unknown>
    occurred_at: string
    flea_markets: {
      name: string | null
      slug: string | null
      city: string | null
    } | null
  }
}

function mapRow(raw: RawDeliveryRow): NotificationInboxRow {
  const ev = raw.notification_events
  const fm = ev.flea_markets
  return {
    eventId: ev.id,
    eventType: ev.type as NotificationInboxRow['eventType'],
    fleaMarketId: ev.flea_market_id,
    marketName: fm?.name ?? null,
    marketSlug: fm?.slug ?? null,
    citySlug: ev.city_slug ?? (fm ? null : null),
    cityCanonicalName: fm?.city ?? null,
    payload: ev.payload,
    occurredAt: ev.occurred_at,
    readAt: raw.read_at,
  }
}

export function createSupabaseNotificationRepo(supabase: SupabaseClient): NotificationRepository {
  return {
    async listInbox(userId, opts = {}) {
      const { limit = 50, offset = 0 } = opts

      const { data, error } = await supabase
        .from('notification_deliveries')
        .select(
          `read_at,
           notification_events!inner(
             id, type, flea_market_id, city_slug, payload, occurred_at,
             flea_markets(name, slug, city)
           )`,
        )
        .eq('user_id', userId)
        .eq('channel', 'inbox')
        .gte('notification_events.occurred_at', cutoffIso())
        .order('notification_events(occurred_at)', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw new Error(`Failed to list inbox for user ${userId}: ${error.message}`)
      return ((data ?? []) as unknown as RawDeliveryRow[]).map(mapRow)
    },

    async unreadCount(userId) {
      // Join through notification_events to enforce the 30-day cutoff on
      // occurred_at, keeping count consistent with listInbox.
      const { data, error } = await supabase
        .from('notification_deliveries')
        .select('notification_events!inner(occurred_at)')
        .eq('user_id', userId)
        .eq('channel', 'inbox')
        .is('read_at', null)
        .gte('notification_events.occurred_at', cutoffIso())

      if (error) throw new Error(`Failed to get unread count for user ${userId}: ${error.message}`)
      return (data ?? []).length
    },

    async markRead(userId, eventId) {
      // RLS blocks direct UPDATE on notification_deliveries (service_role
      // only). Goes through the SECURITY DEFINER RPC which validates
      // auth.uid() = p_user_id server-side and only touches read_at.
      const { error } = await supabase.rpc('mark_notification_read', {
        p_user_id: userId,
        p_event_id: eventId,
      })
      if (error) throw new Error(`Failed to mark notification read for event ${eventId}: ${error.message}`)
    },

    async markAllRead(userId) {
      const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userId })

      if (error) throw new Error(`Failed to mark all notifications read for user ${userId}: ${error.message}`)
    },
  }
}
