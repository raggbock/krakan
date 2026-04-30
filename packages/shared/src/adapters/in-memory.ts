import type { AuthPort, AuthUser } from '../ports/auth'
import type { ServerDataPort } from '../ports/server'
import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from '../ports/flea-markets'
import type { BookingRepository } from '../ports/bookings'
import type { RouteRepository } from '../ports/routes'
import type { ProfileRepository, OrganizerRepository } from '../ports/profiles'
import { createInMemoryFleaMarkets, createInMemorySearch, createInMemoryMarketTables } from './in-memory/flea-markets'
import { createInMemoryBookings } from './in-memory/bookings'
import { createInMemoryRoutes } from './in-memory/routes'
import { createInMemoryProfiles, createInMemoryOrganizers } from './in-memory/profiles'

export function createInMemoryAuth(initialUser?: AuthUser): AuthPort {
  let currentUser: AuthUser | null = initialUser ?? null
  const listeners: Array<(user: AuthUser | null) => void> = []

  return {
    async getSession() {
      return { user: currentUser }
    },
    onAuthStateChange(cb) {
      listeners.push(cb)
      return () => {
        const idx = listeners.indexOf(cb)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    },
    async signIn(_email, _password) {
      currentUser = { id: 'test-user', email: _email }
      listeners.forEach((cb) => cb(currentUser))
    },
    async signUp(_email, _password) {
      currentUser = { id: 'test-user', email: _email }
      listeners.forEach((cb) => cb(currentUser))
      return { needsEmailConfirmation: false }
    },
    async signInWithGoogle() {
      currentUser = { id: 'test-user', email: 'google@test.com' }
      listeners.forEach((cb) => cb(currentUser))
    },
    async signOut() {
      currentUser = null
      listeners.forEach((cb) => cb(null))
    },
    async resetPasswordForEmail() {},
    async updatePassword() {},
  }
}

type MarketMeta = Awaited<ReturnType<ServerDataPort['getMarketMeta']>>
type RouteMeta = Awaited<ReturnType<ServerDataPort['getRouteMeta']>>
type OrganizerMeta = Awaited<ReturnType<ServerDataPort['getOrganizerMeta']>>
type BlockSaleMeta = Awaited<ReturnType<ServerDataPort['getBlockSaleMeta']>>

export function createInMemoryServerData(seed?: {
  markets?: Array<NonNullable<MarketMeta> & { id: string; slug?: string | null; updatedAt: string }>
  routes?: Array<NonNullable<RouteMeta> & { id: string; updatedAt: string }>
  organizers?: Array<NonNullable<OrganizerMeta> & { id: string }>
  blockSales?: Array<NonNullable<BlockSaleMeta> & { id: string; slug: string; updatedAt: string; publishedAt: string | null }>
}): ServerDataPort {
  const markets = seed?.markets ?? []
  const routes = seed?.routes ?? []
  const organizers = seed?.organizers ?? []
  const blockSales = seed?.blockSales ?? []

  return {
    async getMarketIdBySlug(slug) {
      // Mirrors the supabase adapter: returns drafts too, only filters out
      // soft-deleted markets. The seed shape doesn't track is_deleted, so
      // every seeded market is treated as live.
      return markets.find((m) => m.slug === slug)?.id ?? null
    },
    async getMarketSlugById(id) {
      return markets.find((m) => m.id === id)?.slug ?? null
    },
    async getMarketMeta(id) {
      return markets.find((m) => m.id === id) ?? null
    },
    async getRouteMeta(id) {
      return routes.find((r) => r.id === id) ?? null
    },
    async getOrganizerMeta(id) {
      return organizers.find((o) => o.id === id) ?? null
    },
    async listPublishedMarketIds() {
      return markets.map((m) => ({ id: m.id, slug: m.slug ?? null, updatedAt: m.updatedAt }))
    },
    async listCitiesWithMarkets() {
      const byCity = new Map<string, { count: number; latest: string }>()
      for (const m of markets) {
        const city = (m as unknown as { city?: string }).city
        if (!city) continue
        const cur = byCity.get(city)
        if (cur) {
          cur.count += 1
          if (m.updatedAt > cur.latest) cur.latest = m.updatedAt
        } else {
          byCity.set(city, { count: 1, latest: m.updatedAt })
        }
      }
      return Array.from(byCity.entries()).map(([city, { count, latest }]) => ({
        city, marketCount: count, latestUpdate: latest,
      }))
    },
    async listMarketsInCity() { return [] },
    async listBlockSalesInCity(city) {
      const today = new Date().toISOString().slice(0, 10)
      return blockSales
        .filter((bs) => bs.publishedAt !== null && bs.city === city && bs.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((bs) => ({ id: bs.id, slug: bs.slug, name: bs.name, startDate: bs.startDate, endDate: bs.endDate }))
    },
    async listPublishedRouteIds() {
      return routes.map((r) => ({ id: r.id, updatedAt: r.updatedAt }))
    },
    async getBlockSaleIdBySlug(slug) {
      return blockSales.find((bs) => bs.slug === slug)?.id ?? null
    },
    async listPublishedBlockSaleIds() {
      return blockSales
        .filter((bs) => bs.publishedAt !== null)
        .map((bs) => ({ id: bs.id, slug: bs.slug, updatedAt: bs.updatedAt, endDate: bs.endDate }))
    },
    async getBlockSaleMeta(id) {
      return blockSales.find((bs) => bs.id === id) ?? null
    },
  }
}

/**
 * createInMemoryStack — wires all in-memory repositories together into a
 * single coherent stack. Use this in hook seam-tests and integration tests
 * instead of wiring each repo by hand.
 *
 * The `profiles` repo is injected into `fleaMarkets` so that `details()`
 * can resolve `organizerName` from the shared profiles store.
 * The `fleaMarkets` repo is injected into `search` so queries run against
 * the real in-memory store rather than a private Map snapshot.
 */
export function createInMemoryStack(): {
  fleaMarkets: FleaMarketRepository
  search: SearchRepository
  marketTables: MarketTableRepository
  bookings: BookingRepository
  routes: RouteRepository
  profiles: ProfileRepository
  organizers: OrganizerRepository
} {
  const profiles = createInMemoryProfiles()
  const organizers = createInMemoryOrganizers()
  const fleaMarkets = createInMemoryFleaMarkets([], { profiles })
  const search = createInMemorySearch({ fleaMarkets })
  const marketTables = createInMemoryMarketTables()
  const bookings = createInMemoryBookings()
  const routes = createInMemoryRoutes()

  return { fleaMarkets, search, marketTables, bookings, routes, profiles, organizers }
}
