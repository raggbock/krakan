/**
 * RouteRepository — port for loppisrunda (route) persistence.
 *
 * Extends Publishable (publish / unpublish). All mutations go through the
 * `runRouteMutation` saga; callers should not call `create` / `update` directly
 * from UI components.
 *
 * Implementations: adapters/supabase/routes.ts, adapters/in-memory/routes.ts.
 */

import type {
  CreateRoutePayload,
  UpdateRoutePayload,
  RouteWithStops,
  RouteSummary,
  PopularRouteView,
} from '../types'
import type { Publishable } from './publishable'

export interface RouteRepository extends Publishable {
  create(payload: CreateRoutePayload): Promise<{ id: string }>
  get(id: string): Promise<RouteWithStops>
  update(id: string, payload: UpdateRoutePayload): Promise<void>
  delete(id: string): Promise<void>
  listByUser(userId: string): Promise<RouteSummary[]>
  listPopular(params: { latitude: number; longitude: number; radiusKm?: number }): Promise<PopularRouteView[]>
}
