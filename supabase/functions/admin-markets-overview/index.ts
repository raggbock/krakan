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

    // PostgREST caps responses at db.max_rows (1000 in Supabase defaults)
    // regardless of any client-side .limit() — so .range() is the only way
    // to get every row. Page through each table in 1000-row chunks until
    // the slice comes back smaller than the page size.
    const PAGE = 1000

    async function pageMarkets() {
      const out: Record<string, unknown>[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin.from('flea_markets')
          .select('id, slug, name, city, street, zip_code, country, status, category, is_system_owned, is_permanent, published_at, contact_email, contact_phone, contact_website, contact_facebook, contact_instagram, latitude, longitude, location, updated_at')
          .eq('is_deleted', false)
          .order('updated_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = data ?? []
        out.push(...rows)
        if (rows.length < PAGE) break
      }
      return out
    }
    async function pageRules() {
      const out: Record<string, unknown>[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin.from('opening_hour_rules')
          .select('id, flea_market_id, type, day_of_week, anchor_date, open_time, close_time')
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = data ?? []
        out.push(...rows)
        if (rows.length < PAGE) break
      }
      return out
    }
    async function pageTokens() {
      const out: Record<string, unknown>[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin.from('business_owner_tokens')
          .select('flea_market_id, used_at, invalidated_at, expires_at, sent_at')
          .order('expires_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = data ?? []
        out.push(...rows)
        if (rows.length < PAGE) break
      }
      return out
    }

    const [markets, rules, tokens] = await Promise.all([pageMarkets(), pageRules(), pageTokens()])

    // Group rules by market.
    const rulesByMarket = new Map<string, Array<{
      id: string
      type: 'weekly' | 'biweekly' | 'date'
      dayOfWeek: number | null
      anchorDate: string | null
      openTime: string
      closeTime: string
    }>>()
    for (const r of rules ?? []) {
      const marketId = r.flea_market_id as string
      const list = rulesByMarket.get(marketId) ?? []
      list.push({
        id: r.id as string,
        type: r.type as 'weekly' | 'biweekly' | 'date',
        dayOfWeek: (r.day_of_week as number | null) ?? null,
        anchorDate: (r.anchor_date as string | null) ?? null,
        openTime: r.open_time as string,
        closeTime: r.close_time as string,
      })
      rulesByMarket.set(marketId, list)
    }

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
        sentAt: sentAt && (!prev?.sentAt || sentAt > prev.sentAt) ? sentAt : (prev?.sentAt ?? null),
      }
      tokensByMarket.set(marketId, next)
    }

    return {
      markets: (markets ?? []).map((m) => {
        const id = m.id as string
        const isSystemOwned = (m.is_system_owned as boolean | null) ?? false
        const website = (m.contact_website as string | null) ?? null
        const facebook = (m.contact_facebook as string | null) ?? null
        const instagram = (m.contact_instagram as string | null) ?? null
        const phone = (m.contact_phone as string | null) ?? null
        const email = (m.contact_email as string | null) ?? null
        const lat = (m.latitude as number | null) ?? null
        const lng = (m.longitude as number | null) ?? null
        return {
          id,
          slug: (m.slug as string | null) ?? null,
          name: m.name as string,
          city: (m.city as string | null) ?? null,
          street: (m.street as string | null) ?? null,
          zipCode: (m.zip_code as string | null) ?? null,
          country: (m.country as string | null) ?? null,
          status: (m.status as string | null) ?? 'confirmed',
          category: (m.category as string | null) ?? null,
          isSystemOwned,
          isPublished: m.published_at != null,
          isPermanent: (m.is_permanent as boolean | null) ?? false,
          contactWebsite: website,
          contactFacebook: facebook,
          contactInstagram: instagram,
          contactPhone: phone,
          contactEmail: email,
          hasWebsite: !!website,
          hasFacebook: !!facebook,
          hasInstagram: !!instagram,
          hasPhone: !!phone,
          hasEmail: !!email,
          hasOpeningHours: (rulesByMarket.get(id)?.length ?? 0) > 0,
          hasCoordinates: lat != null && lng != null,
          latitude: lat,
          longitude: lng,
          openingHourRules: rulesByMarket.get(id) ?? [],
          takeover: isSystemOwned
            ? (tokensByMarket.get(id) ?? { hasActiveToken: false, used: false, expired: false, sentAt: null })
            : null,
          updatedAt: (m.updated_at as string | null) ?? null,
        }
      }),
    }
  },
})
