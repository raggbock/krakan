import { defineAdminEndpoint } from '../_shared/endpoint.ts'
import {
  AdminTakeoverPendingInput,
  AdminTakeoverPendingOutput,
} from '@fyndstigen/shared/contracts/admin-takeover-send.ts'

defineAdminEndpoint({
  name: 'admin-takeover-pending',
  input: AdminTakeoverPendingInput,
  output: AdminTakeoverPendingOutput,
  handler: async ({ admin }) => {
    // System-owned markets that still have an active (unused, unrevoked,
    // unexpired) token flagged for sending.
    const nowIso = new Date().toISOString()
    const { data: tokens, error: tErr } = await admin
      .from('business_owner_tokens')
      .select('flea_market_id, priority, sent_at')
      .eq('should_send_email', true)
      .is('used_at', null)
      .is('invalidated_at', null)
      .gt('expires_at', nowIso)
    if (tErr) throw new Error(tErr.message)

    if (!tokens || tokens.length === 0) return { markets: [] }

    // One market may have multiple active tokens — keep the highest-
    // priority one (lowest 'priority' value = most important); break
    // ties by most recent sent_at (nulls last).
    const byMarket = new Map<string, { priority: number; sentAt: string | null }>()
    for (const t of tokens) {
      const marketId = t.flea_market_id as string
      const incoming = { priority: t.priority as number, sentAt: (t.sent_at as string | null) ?? null }
      const prev = byMarket.get(marketId)
      if (!prev || incoming.priority < prev.priority ||
          (incoming.priority === prev.priority && (incoming.sentAt ?? '') > (prev.sentAt ?? ''))) {
        byMarket.set(marketId, incoming)
      }
    }

    const marketIds = Array.from(byMarket.keys())
    const { data: markets, error: mErr } = await admin
      .from('flea_markets')
      .select('id, name, city, contact_email, is_system_owned')
      .in('id', marketIds)
      .eq('is_system_owned', true)
    if (mErr) throw new Error(mErr.message)

    return {
      markets: (markets ?? []).map((m) => {
        const meta = byMarket.get(m.id as string)!
        return {
          marketId: m.id as string,
          name: m.name as string,
          city: (m.city as string | null) ?? null,
          contactEmail: (m.contact_email as string | null) ?? null,
          priority: meta.priority,
          sentAt: meta.sentAt,
        }
      }),
    }
  },
})
