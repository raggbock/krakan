import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServerDataPort } from '../../ports/server'

export function createSupabaseServerData(supabase: SupabaseClient): ServerDataPort {
  return {
    async getMarketIdBySlug(slug) {
      // Query the base table, not visible_flea_markets, so owners can still
      // reach their unpublished drafts via /loppis/[slug] (and via the
      // 308 redirect from the legacy /fleamarkets/[id] URL after creating
      // a new market). The metadata layer marks drafts noindex so Google
      // doesn't index them, and the client component already handles the
      // owner-vs-stranger distinction with a draft banner.
      //
      // Only is_deleted is filtered here — soft-deleted markets must not
      // be reachable by anyone.
      const { data } = await supabase
        .from('flea_markets')
        .select('id')
        .eq('slug', slug)
        .eq('is_deleted', false)
        .maybeSingle()
      return (data?.id as string | undefined) ?? null
    },

    async getMarketSlugById(id) {
      // Filter is_deleted so the legacy /fleamarkets/[id] route 404s
      // directly for soft-deleted markets instead of redirecting to a
      // /loppis/[slug] URL that would itself 404. Cleaner UX, fewer
      // confused users, and one fewer hop for crawlers.
      const { data } = await supabase
        .from('flea_markets')
        .select('slug')
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle()
      return (data?.slug as string | null | undefined) ?? null
    },

    async getMarketMeta(id) {
      const { data: market } = await supabase
        .from('flea_markets')
        .select(`
          name, description, city, street, zip_code, is_permanent, latitude, longitude, published_at,
          organizer:profiles!organizer_id(subscription_tier),
          opening_hour_rules(type, day_of_week, anchor_date, open_time, close_time),
          market_tables(price_sek, is_available),
          flea_market_images(storage_path, sort_order)
        `)
        .eq('id', id)
        .single()

      if (!market) return null

      // Extract organizer subscription tier
      const organizer = market.organizer as unknown as { subscription_tier: number } | null
      const organizer_subscription_tier = organizer?.subscription_tier ?? 0

      // Extract opening hour rules
      const opening_hour_rules = ((market.opening_hour_rules as unknown as Array<{
        type: string; day_of_week: number | null; anchor_date: string | null
        open_time: string; close_time: string
      }>) ?? [])

      // Compute price range from available tables
      const tables = (market.market_tables as unknown as Array<{ price_sek: number; is_available: boolean }>) ?? []
      const availableTables = tables.filter((t) => t.is_available)
      const price_range = availableTables.length > 0
        ? {
            min_sek: Math.min(...availableTables.map((t) => t.price_sek)),
            max_sek: Math.max(...availableTables.map((t) => t.price_sek)),
          }
        : null

      // Get first image URL
      const images = (market.flea_market_images as unknown as Array<{ storage_path: string; sort_order: number }>) ?? []
      const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order)
      const firstImage = sortedImages[0]
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const image_url = firstImage
        ? `${supabaseUrl}/storage/v1/object/public/flea-market-images/${firstImage.storage_path}`
        : null

      return {
        name: market.name,
        description: market.description,
        city: market.city,
        street: market.street,
        zip_code: market.zip_code,
        latitude: market.latitude,
        longitude: market.longitude,
        is_permanent: market.is_permanent,
        published_at: (market.published_at as string | null) ?? null,
        organizer_subscription_tier,
        opening_hour_rules,
        price_range,
        image_url,
      }
    },

    async getRouteMeta(id) {
      const { data } = await supabase
        .from('routes')
        .select(`
          name, description,
          route_stops(position, flea_markets(id, slug, name, city, latitude, longitude))
        `)
        .eq('id', id)
        .single()
      if (!data) return null
      const row = data as unknown as {
        name: string
        description: string | null
        route_stops?: Array<{
          position: number
          flea_markets: {
            id: string
            slug: string | null
            name: string
            city: string
            latitude: number | null
            longitude: number | null
          } | null
        }>
      }
      const stops = (row.route_stops ?? [])
        .filter((s) => s.flea_markets)
        .map((s) => ({
          position: s.position,
          marketId: s.flea_markets!.id,
          marketSlug: s.flea_markets!.slug,
          marketName: s.flea_markets!.name,
          city: s.flea_markets!.city,
          latitude: s.flea_markets!.latitude,
          longitude: s.flea_markets!.longitude,
        }))
        .sort((a, b) => a.position - b.position)
      return {
        name: row.name,
        description: row.description,
        stopCount: stops.length,
        stops,
      }
    },

    async getOrganizerMeta(id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, bio, website')
        .eq('id', id)
        .single()
      if (!profile) return null

      const { count } = await supabase
        .from('visible_flea_markets')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', id)

      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Arrangör'
      return {
        name,
        bio: profile.bio,
        website: profile.website,
        marketCount: count ?? 0,
      }
    },

    async listPublishedMarketIds() {
      const { data } = await supabase
        .from('visible_flea_markets')
        .select('id, slug, updated_at')
      return (data ?? []).map((m) => ({
        id: m.id as string,
        slug: (m.slug as string | null | undefined) ?? null,
        updatedAt: m.updated_at as string,
      }))
    },

    async listPublishedRouteIds() {
      const { data } = await supabase
        .from('routes')
        .select('id, updated_at')
        .eq('is_published', true)
        .eq('is_deleted', false)
      return (data ?? []).map((r) => ({ id: r.id, updatedAt: r.updated_at }))
    },

    async listCitiesWithMarkets() {
      const { data } = await supabase
        .from('visible_flea_markets')
        .select('city, updated_at')
      const byCity = new Map<string, { count: number; latest: string }>()
      for (const row of data ?? []) {
        if (!row.city) continue
        const cur = byCity.get(row.city)
        if (cur) {
          cur.count += 1
          if (row.updated_at > cur.latest) cur.latest = row.updated_at
        } else {
          byCity.set(row.city, { count: 1, latest: row.updated_at })
        }
      }
      return Array.from(byCity.entries()).map(([city, { count, latest }]) => ({
        city,
        marketCount: count,
        latestUpdate: latest,
      }))
    },

    async getBlockSaleIdBySlug(slug) {
      const { data } = await supabase
        .from('block_sales').select('id')
        .eq('slug', slug).eq('is_deleted', false).maybeSingle()
      return (data?.id as string | undefined) ?? null
    },

    async listPublishedBlockSaleIds() {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('block_sales')
        .select('id, slug, updated_at, end_date')
        .eq('is_deleted', false)
        .not('published_at', 'is', null)
        .gte('end_date', cutoff)
      return (data ?? []).map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        updatedAt: r.updated_at as string,
        endDate: r.end_date as string,
      }))
    },

    async getBlockSaleMeta(id) {
      const { data: bs } = await supabase
        .from('block_sales')
        .select(`
          name, description, city, region, start_date, end_date,
          daily_open, daily_close, latitude, longitude, published_at, organizer_id,
          visible_block_sale_stands(id, street, city, description, latitude, longitude)
        `)
        .eq('id', id).eq('is_deleted', false).maybeSingle()
      if (!bs) return null
      const stands = (bs.visible_block_sale_stands as unknown as Array<{
        id: string; street: string; city: string; description: string
        latitude: number | null; longitude: number | null
      }>) ?? []
      return {
        name: bs.name as string,
        description: (bs.description as string | null) ?? null,
        city: bs.city as string,
        region: (bs.region as string | null) ?? null,
        startDate: bs.start_date as string,
        endDate: bs.end_date as string,
        dailyOpen: (bs.daily_open as string).slice(0, 5),
        dailyClose: (bs.daily_close as string).slice(0, 5),
        centerLatitude: (bs.latitude as number | null) ?? null,
        centerLongitude: (bs.longitude as number | null) ?? null,
        publishedAt: (bs.published_at as string | null) ?? null,
        organizerId: bs.organizer_id as string,
        approvedStands: stands.map((s) => ({
          id: s.id, street: s.street, city: s.city, description: s.description,
          latitude: s.latitude ?? null, longitude: s.longitude ?? null,
        })),
      }
    },

    async listBlockSalesInCity(city) {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('block_sales')
        .select('id, slug, name, start_date, end_date')
        .eq('city', city)
        .eq('is_deleted', false)
        .not('published_at', 'is', null)
        .gte('end_date', today)
        .order('start_date', { ascending: true })
      return (data ?? []).map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        name: r.name as string,
        startDate: r.start_date as string,
        endDate: r.end_date as string,
      }))
    },

    async listMarketsInCity(cityNames) {
      if (cityNames.length === 0) return []
      const { data } = await supabase
        .from('visible_flea_markets')
        .select('id, slug, name, description, street, is_permanent, city, flea_market_images(storage_path, sort_order)')
        .in('city', cityNames)
        .order('updated_at', { ascending: false })
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      return (data ?? []).map((m) => {
        const images = (m.flea_market_images as unknown as Array<{ storage_path: string; sort_order: number }>) ?? []
        const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)
        const first = sorted[0]
        return {
          id: m.id as string,
          slug: (m.slug as string | null | undefined) ?? null,
          name: m.name as string,
          description: m.description as string | null,
          street: m.street as string,
          is_permanent: m.is_permanent as boolean,
          city: m.city as string,
          image_url: first
            ? `${supabaseUrl}/storage/v1/object/public/flea-market-images/${first.storage_path}`
            : null,
        }
      })
    },
  }
}
