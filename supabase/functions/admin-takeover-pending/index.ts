import { defineAdminEndpoint } from '../_shared/endpoint.ts'
import {
  AdminTakeoverPendingInput,
  AdminTakeoverPendingOutput,
} from '@fyndstigen/shared/contracts/admin-takeover-send.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type HandleTakeoverPendingDeps = {
  admin: SupabaseClient
}

type PendingMarket = {
  marketId: string
  name: string
  city: string | null
  contactEmail: string | null
  priority: number
  sentAt: string | null
}

export async function handleTakeoverPending(
  { admin }: HandleTakeoverPendingDeps,
): Promise<{ markets: PendingMarket[] }> {
  // System-owned markets that still have an active (unused, unrevoked,
  // unexpired) token flagged for sending. The market columns come via an
  // embedded inner join in the SAME request — fetching them with a second
  // `.in('id', [...])` query puts every market id in the request URL, and
  // past a few hundred ids (~15 kB) the edge runtime's outbound HTTP/2
  // client resets the stream.
  const nowIso = new Date().toISOString()
  const { data: tokens, error } = await admin
    .from('business_owner_tokens')
    .select('flea_market_id, priority, sent_at, flea_markets!inner(name, city, contact_email)')
    .eq('should_send_email', true)
    .is('used_at', null)
    .is('invalidated_at', null)
    .gt('expires_at', nowIso)
    .eq('flea_markets.is_system_owned', true)
  if (error) throw new Error(error.message)

  // One market may have multiple active tokens — keep the highest-
  // priority one (lowest 'priority' value = most important); break
  // ties by most recent sent_at (nulls last).
  const byMarket = new Map<string, PendingMarket>()
  for (const t of tokens ?? []) {
    const market = t.flea_markets as unknown as {
      name: string
      city: string | null
      contact_email: string | null
    }
    const incoming: PendingMarket = {
      marketId: t.flea_market_id as string,
      name: market.name,
      city: market.city ?? null,
      contactEmail: market.contact_email ?? null,
      priority: t.priority as number,
      sentAt: (t.sent_at as string | null) ?? null,
    }
    const prev = byMarket.get(incoming.marketId)
    if (!prev || incoming.priority < prev.priority ||
        (incoming.priority === prev.priority && (incoming.sentAt ?? '') > (prev.sentAt ?? ''))) {
      byMarket.set(incoming.marketId, incoming)
    }
  }

  return { markets: Array.from(byMarket.values()) }
}

defineAdminEndpoint({
  name: 'admin-takeover-pending',
  input: AdminTakeoverPendingInput,
  output: AdminTakeoverPendingOutput,
  handler: ({ admin }) => handleTakeoverPending({ admin }),
})
