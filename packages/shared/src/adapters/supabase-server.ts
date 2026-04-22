import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServerDataPort } from '../ports/server'

export function createSupabaseServerData(supabase: SupabaseClient): ServerDataPort {
  return {
    async getMarketMeta(id) {
      const { data: market } = await supabase
        .from('flea_markets')
        .select(`
          name, description, city, street, zip_code, is_permanent, latitude, longitude,
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
        organizer_subscription_tier,
        opening_hour_rules,
        price_range,
        image_url,
      }
    },

    async getRouteMeta(id) {
      const { data } = await supabase
        .from('routes')
        .select('name, description, route_stops(id)')
        .eq('id', id)
        .single()
      if (!data) return null
      return {
        name: data.name,
        description: data.description,
        stopCount: (data as Record<string, unknown>).route_stops
          ? ((data as Record<string, unknown>).route_stops as unknown[]).length
          : 0,
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
        .from('flea_markets')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', id)
        .not('published_at', 'is', null)
        .eq('is_deleted', false)

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
        .select('id, updated_at')
      return (data ?? []).map((m) => ({ id: m.id, updatedAt: m.updated_at }))
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

    async listMarketsInCity(cityNames) {
      if (cityNames.length === 0) return []
      const { data } = await supabase
        .from('visible_flea_markets')
        .select('id, name, description, street, is_permanent, city, flea_market_images(storage_path, sort_order)')
        .in('city', cityNames)
        .order('updated_at', { ascending: false })
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      return (data ?? []).map((m) => {
        const images = (m.flea_market_images as unknown as Array<{ storage_path: string; sort_order: number }>) ?? []
        const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)
        const first = sorted[0]
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          street: m.street,
          is_permanent: m.is_permanent,
          city: m.city,
          image_url: first
            ? `${supabaseUrl}/storage/v1/object/public/flea-market-images/${first.storage_path}`
            : null,
        }
      })
    },
  }
}
