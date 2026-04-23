import type {
  CreateRoutePayload,
  UpdateRoutePayload,
  RouteWithStops,
  RouteSummary,
  PopularRoute,
} from '../../types'
import type { RouteRepository } from '../../ports/routes'

export type StoredRoute = {
  id: string
  name: string
  description: string | null
  created_by: string
  start_latitude: number | null
  start_longitude: number | null
  planned_date: string | null
  is_published: boolean
  published_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  stops: { flea_market_id: string; sort_order: number }[]
}

let _rid = 1

export function createInMemoryRoutes(seed: StoredRoute[] = []): RouteRepository {
  const store = new Map<string, StoredRoute>(seed.map((r) => [r.id, { ...r }]))

  return {
    async create(payload: CreateRoutePayload) {
      const id = `rt-${_rid++}`
      const now = new Date().toISOString()
      const route: StoredRoute = {
        id,
        name: payload.name,
        description: payload.description ?? null,
        created_by: payload.createdBy,
        start_latitude: payload.startLatitude ?? null,
        start_longitude: payload.startLongitude ?? null,
        planned_date: payload.plannedDate ?? null,
        is_published: false,
        published_at: null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        stops: (payload.stops ?? []).map((s, i) => ({
          flea_market_id: s.fleaMarketId,
          sort_order: i,
        })),
      }
      store.set(id, route)
      return { id }
    },

    async get(id: string): Promise<RouteWithStops> {
      const r = store.get(id)
      if (!r) throw new Error(`Route ${id} not found`)
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        created_by: r.created_by,
        start_latitude: r.start_latitude,
        start_longitude: r.start_longitude,
        planned_date: r.planned_date,
        is_published: r.is_published,
        published_at: r.published_at,
        is_deleted: r.is_deleted,
        created_at: r.created_at,
        updated_at: r.updated_at,
        creatorName: '',
        stops: r.stops.map((s, i) => ({
          id: `stop-${i}`,
          sortOrder: s.sort_order,
          fleaMarket: null,
        })),
      } as RouteWithStops
    },

    async update(id: string, payload: UpdateRoutePayload) {
      const existing = store.get(id)
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, {
        ...existing,
        name: payload.name,
        description: payload.description ?? null,
        start_latitude: payload.startLatitude ?? null,
        start_longitude: payload.startLongitude ?? null,
        planned_date: payload.plannedDate ?? null,
        updated_at: new Date().toISOString(),
        stops: (payload.stops ?? []).map((s, i) => ({
          flea_market_id: s.fleaMarketId,
          sort_order: i,
        })),
      })
    },

    async delete(id: string) {
      const existing = store.get(id)
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, { ...existing, is_deleted: true })
    },

    async publish(id: string) {
      const existing = store.get(id)
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, {
        ...existing,
        is_published: true,
        published_at: new Date().toISOString(),
      })
    },

    async unpublish(id: string) {
      const existing = store.get(id)
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, { ...existing, is_published: false, published_at: null })
    },

    async listByUser(userId: string): Promise<RouteSummary[]> {
      return Array.from(store.values())
        .filter((r) => r.created_by === userId && !r.is_deleted)
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          created_by: r.created_by,
          start_latitude: r.start_latitude,
          start_longitude: r.start_longitude,
          planned_date: r.planned_date,
          is_published: r.is_published,
          published_at: r.published_at,
          is_deleted: r.is_deleted,
          created_at: r.created_at,
          updated_at: r.updated_at,
          stopCount: r.stops.length,
        })) as RouteSummary[]
    },

    /**
     * @stub Returns empty array — not implemented for in-memory use.
     * Seam tests that call this will get a silent false-negative.
     * Provide real data via seed and a custom implementation if you need to assert against results.
     */
    async listPopular(_params): Promise<PopularRoute[]> {
      console.warn('[in-memory] listPopular() is a stub and always returns []. Seed the repo if you need results.')
      return []
    },
  }
}
