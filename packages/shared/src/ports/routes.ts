import type {
  CreateRoutePayload,
  UpdateRoutePayload,
  RouteWithStops,
  RouteSummary,
  PopularRoute,
} from '../types'
import type { Publishable } from './publishable'

export interface RouteRepository extends Publishable {
  create(payload: CreateRoutePayload): Promise<{ id: string }>
  get(id: string): Promise<RouteWithStops>
  update(id: string, payload: UpdateRoutePayload): Promise<void>
  delete(id: string): Promise<void>
  listByUser(userId: string): Promise<RouteSummary[]>
  listPopular(params: { latitude: number; longitude: number; radiusKm?: number }): Promise<PopularRoute[]>
}
