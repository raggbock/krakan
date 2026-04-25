import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminMarketsOverviewInput,
  AdminMarketsOverviewOutput,
} from '@fyndstigen/shared/contracts/admin-markets-overview.ts'

defineEndpoint({
  name: 'admin-markets-overview',
  input: AdminMarketsOverviewInput,
  output: AdminMarketsOverviewOutput,
  handler: async ({ user, admin }) => {
    const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: user.id })
    if (rpcErr) throw new Error(rpcErr.message)
    if (!isAdminResult) throw new HttpError(403, 'not_admin')

    const [
      { data: markets, error: mErr },
      { data: rules, error: rErr },
      { data: tokens, error: tErr },
    ] = await Promise.all([
      admin.from('flea_markets')
        .select('id, slug, name, city, status, category, is_system_owned, is_permanent, published_at, contact_email, contact_phone, contact_website, location, updated_at')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false }),
      admin.from('opening_hour_rules').select('flea_market_id'),
      admin.from('business_owner_tokens')
        .select('flea_market_id, used_at, invalidated_at, expires_at, sent_at'),
    ])
    if (mErr) throw new Error(mErr.message)
    if (rErr) throw new Error(rErr.message)
    if (tErr) throw new Error(tErr.message)

    // Markets with at least one rule.
    const marketsWithRules = new Set<string>()
    for (const r of rules ?? []) marketsWithRules.add(r.flea_market_id as string)

    // Aggregate token state per market.
    const nowMs = Date.now()
    type TokenAgg = { hasActiveToken: boolean; used: boolean; expired: boolean; sentAt: string | null }
    const tokensByMarket = new Map<string, TokenAgg>()
    for (const t of tokens ?? []) {
      const marketId = t.flea_market_id as string
      const usedAt = t.used_at as string | null
      const invalidatedAt = t.invalidated_at as string | null
      const expiresAt = t.expires_at as string
      const sentAt = (t.sent_at as string | null) ?? null
      const isExpired = !usedAt && !invalidatedAt && Date.parse(expiresAt) < nowMs
      const isActive = !usedAt && !invalidatedAt && !isExpired

      const prev = tokensByMarket.get(marketId)
      const next: TokenAgg = {
        hasActiveToken: (prev?.hasActiveToken ?? false) || isActive,
        used: (prev?.used ?? false) || !!usedAt,
        expired: (prev?.expired ?? false) || isExpired,
        // Most recent sent_at across all tokens for this market.
        sentAt: sentAt && (!prev?.sentAt || sentAt > prev.sentAt) ? sentAt : (prev?.sentAt ?? null),
      }
      tokensByMarket.set(marketId, next)
    }

    return {
      markets: (markets ?? []).map((m) => {
        const id = m.id as string
        const isSystemOwned = (m.is_system_owned as boolean | null) ?? false
        return {
          id,
          slug: (m.slug as string | null) ?? null,
          name: m.name as string,
          city: (m.city as string | null) ?? null,
          status: (m.status as string | null) ?? 'confirmed',
          category: (m.category as string | null) ?? null,
          isSystemOwned,
          isPublished: m.published_at != null,
          isPermanent: (m.is_permanent as boolean | null) ?? false,
          hasWebsite: !!(m.contact_website as string | null),
          hasPhone: !!(m.contact_phone as string | null),
          hasEmail: !!(m.contact_email as string | null),
          hasOpeningHours: marketsWithRules.has(id),
          hasCoordinates: m.location != null,
          takeover: isSystemOwned
            ? (tokensByMarket.get(id) ?? { hasActiveToken: false, used: false, expired: false, sentAt: null })
            : null,
          updatedAt: (m.updated_at as string | null) ?? null,
        }
      }),
    }
  },
})
