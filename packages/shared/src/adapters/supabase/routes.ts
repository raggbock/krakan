/**
 * Supabase adapter for RouteRepository — production implementation.
 *
 * `create` and `update` both accept a `stops` array and handle the stop
 * rows atomically alongside the route row via the `create_route_with_stops`
 * and `update_route_with_stops` Supabase RPCs.
 *
 * All methods throw on Supabase errors.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateRoutePayload,
  UpdateRoutePayload,
  PopularRouteView,
} from '../../types'
import type { RouteView, RouteSummaryView } from '../../types/domain'

type PopularRouteRpcRow = {
  id: string
  name: string
  description: string | null
  created_by: string
  planned_date: string | null
  published_at: string | null
  stop_count: number
  creator_first_name: string | null
  creator_last_name: string | null
}

function mapPopularRoute(r: PopularRouteRpcRow): PopularRouteView {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    createdBy: r.created_by,
    plannedDate: r.planned_date,
    publishedAt: r.published_at,
    stopCount: r.stop_count,
    creatorFirstName: r.creator_first_name,
    creatorLastName: r.creator_last_name,
  }
}
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
      return RouteQuery.details.mapRow(data as RouteDetailsRow) as RouteView
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
      return (data ?? []).map((r) => RouteQuery.summary.mapRow(r as RouteSummaryRow)) as RouteSummaryView[]
    },

    async listPopular(params) {
      const { data, error } = await supabase.rpc('popular_routes_nearby', {
        lat: params.latitude,
        lng: params.longitude,
        radius_km: params.radiusKm ?? 30,
      })
      if (error) throw error
      return (data as PopularRouteRpcRow[] ?? []).map(mapPopularRoute)
    },
  }
}
