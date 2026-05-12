/**
 * delivery-fan-out — pure function for computing per-user notification deliveries.
 *
 * This mirrors the SQL fan-out trigger in 00054_notification_event_triggers.sql.
 * Keep the dedup rule aligned between the two:
 *   - If a user appears in BOTH marketFollowers and cityFollowers, emit ONE row
 *     with reason='market' (market-follow wins).
 *   - If a user appears in only one list, emit the matching reason.
 *
 * The caller is responsible for supplying the correct follower lists by querying
 * user_market_follows and user_city_follows for the event's flea_market_id / city_slug.
 *
 * The output rows do NOT include a `channel` field — that is added by the
 * SQL trigger (one inbox + one email row per DeliveryRow). The edge function
 * that eventually sends emails may skip the email channel based on user prefs;
 * that decision belongs at delivery time, not fan-out time.
 */

export type NotificationEvent = {
  id: string
  type: 'market.published' | 'market.updated' | 'market.new_date' | 'block_sale.published'
  fleaMarketId: string | null
  citySlug: string | null
  payload: Record<string, unknown>
  occurredAt: string
}

export type DeliveryRow = {
  userId: string
  eventId: string
  reason: 'market' | 'city'
}

export type Followers = {
  /** User IDs following the event's market (if any). */
  marketFollowers: string[]
  /** User IDs following the event's city (if any). */
  cityFollowers: string[]
}

/**
 * Compute deduplicated delivery rows for a single notification event.
 *
 * Rule: if the same user appears in both follower lists, emit ONE row with
 * reason='market'. Otherwise emit with the reason matching the list they're in.
 */
export function fanOutDeliveries(
  event: NotificationEvent,
  followers: Followers,
): DeliveryRow[] {
  const { marketFollowers, cityFollowers } = followers

  // Build sets for O(1) lookup.
  const marketSet = new Set(marketFollowers)
  const citySet = new Set(cityFollowers)

  // Collect all unique user IDs across both lists.
  const allUsers = new Set([...marketFollowers, ...cityFollowers])

  const rows: DeliveryRow[] = []
  for (const userId of allUsers) {
    // market-follow wins over city-follow when user is in both lists.
    const reason: 'market' | 'city' = marketSet.has(userId) ? 'market' : 'city'
    rows.push({ userId, eventId: event.id, reason })
  }

  return rows
}
