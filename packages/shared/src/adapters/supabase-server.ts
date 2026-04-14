import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServerDataPort } from '../ports/server'

export function createSupabaseServerData(supabase: SupabaseClient): ServerDataPort {
  return {
    async getMarketMeta(id) {
      const { data } = await supabase
        .from('flea_markets')
        .select('name, description, city, street, zip_code, is_permanent, latitude, longitude')
        .eq('id', id)
        .single()
      return data
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
        .from('flea_markets')
        .select('id, updated_at')
        .not('published_at', 'is', null)
        .eq('is_deleted', false)
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
  }
}
