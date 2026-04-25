import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateRoutePayload,
  UpdateRoutePayload,
  RouteWithStops,
  RouteSummary,
  PopularRoute,
} from '../../types'
import type { RouteDetailsRow, RouteSummaryRow } from '../../api/mappers'
import type { RouteRepository } from '../../ports/routes'
import { RouteQuery } from '../../query/route'

export function createSupabaseRoutes(supabase: SupabaseClient): RouteRepository {
  return {
    async create(payload) {
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

    async get(id) {
      const { data, error } = await supabase
        .from('routes')
        .select(RouteQuery.details.select)
        .eq('id', id)
        .single()

      if (error) throw error
      return RouteQuery.details.mapRow(data as RouteDetailsRow) as RouteWithStops
    },

    async update(id, payload) {
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

    async delete(id) {
      const { error } = await supabase
        .from('routes')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
    },

    async publish(id) {
      const { error } = await supabase
        .from('routes')
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    async unpublish(id) {
      const { error } = await supabase
        .from('routes')
        .update({ is_published: false, published_at: null })
        .eq('id', id)
      if (error) throw error
    },

    async listByUser(userId) {
      const { data, error } = await supabase
        .from('routes')
        .select(RouteQuery.summary.select)
        .eq('created_by', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map((r) => RouteQuery.summary.mapRow(r as RouteSummaryRow)) as RouteSummary[]
    },

    async listPopular(params) {
      const { data, error } = await supabase.rpc('popular_routes_nearby', {
        lat: params.latitude,
        lng: params.longitude,
        radius_km: params.radiusKm ?? 30,
      })
      if (error) throw error
      return (data ?? []) as PopularRoute[]
    },
  }
}
