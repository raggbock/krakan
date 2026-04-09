import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RouteWithStops,
  RouteSummary,
  PopularRoute,
  CreateRoutePayload,
  UpdateRoutePayload,
} from '../types'

export function createRoutesApi(supabase: SupabaseClient) {
  return {
    routes: {
      create: async (payload: CreateRoutePayload) => {
        const { data, error } = await supabase
          .from('routes')
          .insert({
            name: payload.name,
            description: payload.description,
            created_by: payload.createdBy,
            start_latitude: payload.startLatitude,
            start_longitude: payload.startLongitude,
            planned_date: payload.plannedDate,
          })
          .select('id')
          .single()

        if (error) throw error

        if (payload.stops?.length) {
          const { error: stopsError } = await supabase
            .from('route_stops')
            .insert(
              payload.stops.map((stop, i) => ({
                route_id: data.id,
                flea_market_id: stop.fleaMarketId,
                sort_order: i,
              })),
            )
          if (stopsError) throw stopsError
        }

        return { id: data.id }
      },

      get: async (id: string) => {
        const { data, error } = await supabase
          .from('routes')
          .select(`
            *,
            route_stops (
              id,
              flea_market_id,
              sort_order,
              flea_markets (
                id, name, description, street, zip_code, city, country,
                is_permanent, latitude, longitude,
                opening_hours (day_of_week, date, open_time, close_time)
              )
            ),
            profiles!routes_created_by_fkey (first_name, last_name)
          `)
          .eq('id', id)
          .single()

        if (error) throw error

        const raw = data as Record<string, unknown>
        const profile = raw.profiles as { first_name?: string; last_name?: string } | null
        const stops = ((raw.route_stops ?? []) as Array<Record<string, unknown>>)
          .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
          .map((rs) => {
            const fm = rs.flea_markets as Record<string, unknown> | null
            return {
              id: rs.id as string,
              sortOrder: rs.sort_order as number,
              fleaMarket: fm
                ? { ...fm, openingHours: (fm.opening_hours as unknown[]) ?? [] }
                : null,
            }
          })

        return {
          ...data,
          creatorName: profile
            ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            : '',
          stops,
        } as RouteWithStops
      },

      update: async (id: string, payload: UpdateRoutePayload) => {
        const { error } = await supabase
          .from('routes')
          .update({
            name: payload.name,
            description: payload.description,
            start_latitude: payload.startLatitude,
            start_longitude: payload.startLongitude,
            planned_date: payload.plannedDate,
          })
          .eq('id', id)

        if (error) throw error

        await supabase.from('route_stops').delete().eq('route_id', id)

        if (payload.stops?.length) {
          const { error: stopsError } = await supabase
            .from('route_stops')
            .insert(
              payload.stops.map((stop, i) => ({
                route_id: id,
                flea_market_id: stop.fleaMarketId,
                sort_order: i,
              })),
            )
          if (stopsError) throw stopsError
        }
      },

      delete: async (id: string) => {
        const { error } = await supabase
          .from('routes')
          .update({ is_deleted: true })
          .eq('id', id)
        if (error) throw error
      },

      publish: async (id: string) => {
        const { error } = await supabase
          .from('routes')
          .update({ is_published: true, published_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      },

      unpublish: async (id: string) => {
        const { error } = await supabase
          .from('routes')
          .update({ is_published: false, published_at: null })
          .eq('id', id)
        if (error) throw error
      },

      listByUser: async (userId: string) => {
        const { data, error } = await supabase
          .from('routes')
          .select('*, route_stops(id)')
          .eq('created_by', userId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          stopCount: (r.route_stops as unknown[])?.length ?? 0,
        })) as RouteSummary[]
      },

      listPopular: async (params: { latitude: number; longitude: number; radiusKm?: number }) => {
        const { data, error } = await supabase.rpc('popular_routes_nearby', {
          lat: params.latitude,
          lng: params.longitude,
          radius_km: params.radiusKm ?? 30,
        })
        if (error) throw error
        return (data ?? []) as PopularRoute[]
      },
    },
  }
}
