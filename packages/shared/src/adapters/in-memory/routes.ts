/**
 * In-memory adapter for RouteRepository — test double.
 *
 * Non-atomic: synchronous Map mutations. `StoredRoute` is exported so
 * `makeInMemoryDeps` can accept route seed data directly.
 * `listPopular` always returns an empty array — no SQL aggregation available
 * in the in-memory store.
 */

import type {
  CreateRoutePayload,
  UpdateRoutePayload,
  PopularRouteView,
} from '../../types'
import type { RouteView, RouteSummaryView } from '../../types/domain'
import type { RouteRepository } from '../../ports/routes'

export type StoredRoute = {
  id: string
  name: string
  description: string | null
  createdBy: string
  startLatitude: number | null
  startLongitude: number | null
  plannedDate: string | null
  isPublished: boolean
  publishedAt: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  stops: { fleaMarketId: string; sortOrder: number }[]
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
        createdBy: payload.createdBy,
        startLatitude: payload.startLatitude ?? null,
        startLongitude: payload.startLongitude ?? null,
        plannedDate: payload.plannedDate ?? null,
        isPublished: false,
        publishedAt: null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        stops: (payload.stops ?? []).map((s, i) => ({
          fleaMarketId: s.fleaMarketId,
          sortOrder: i,
        })),
      }
      store.set(id, route)
      return { id }
    },

    async get(id: string): Promise<RouteView> {
      const r = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!r) throw new Error(`Route ${id} not found`)
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        createdBy: r.createdBy,
        startLatitude: r.startLatitude,
        startLongitude: r.startLongitude,
        plannedDate: r.plannedDate,
        isPublished: r.isPublished,
        publishedAt: r.publishedAt,
        isDeleted: r.isDeleted,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        creatorName: '',
        stops: r.stops.map((s, i) => ({
          id: `stop-${i}`,
          sortOrder: s.sortOrder,
          fleaMarket: null,
        })),
      }
    },

    async update(id: string, payload: UpdateRoutePayload) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, {
        ...existing,
        name: payload.name,
        description: payload.description ?? null,
        startLatitude: payload.startLatitude ?? null,
        startLongitude: payload.startLongitude ?? null,
        plannedDate: payload.plannedDate ?? null,
        updatedAt: new Date().toISOString(),
        stops: (payload.stops ?? []).map((s, i) => ({
          fleaMarketId: s.fleaMarketId,
          sortOrder: i,
        })),
      })
    },

    async delete(id: string) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, { ...existing, isDeleted: true })
    },

    async publish(id: string) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, {
        ...existing,
        isPublished: true,
        publishedAt: new Date().toISOString(),
      })
    },

    async unpublish(id: string) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`Route ${id} not found`)
      store.set(id, { ...existing, isPublished: false, publishedAt: null })
    },

    async listByUser(userId: string): Promise<RouteSummaryView[]> {
      return Array.from(store.values())
        .filter((r) => r.createdBy === userId && !r.isDeleted)
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          createdBy: r.createdBy,
          startLatitude: r.startLatitude,
          startLongitude: r.startLongitude,
          plannedDate: r.plannedDate,
          isPublished: r.isPublished,
          publishedAt: r.publishedAt,
          isDeleted: r.isDeleted,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          stopCount: r.stops.length,
        }))
    },

    /**
     * @stub Returns empty array — not implemented for in-memory use.
     * Seam tests that call this will get a silent false-negative.
     * Provide real data via seed and a custom implementation if you need to assert against results.
     */
    async listPopular(_params): Promise<PopularRouteView[]> {
      console.warn('[in-memory] listPopular() is a stub and always returns []. Seed the repo if you need results.')
      return []
    },
  }
}
