import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PopularRoute,
  CreateRoutePayload,
  UpdateRoutePayload,
} from '../types'
import { mapRouteWithStops, mapRouteSummary, type RouteDetailsRow, type RouteSummaryRow } from './mappers'

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
        return mapRouteWithStops(data as RouteDetailsRow)
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
        return (data ?? []).map((r) => mapRouteSummary(r as RouteSummaryRow))
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
