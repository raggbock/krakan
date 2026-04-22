import type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  MarketTable,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  SearchResult,
  OpeningHourRule,
} from '../../types'
import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from '../../ports/flea-markets'
import type { ProfileRepository } from '../../ports/profiles'

let _id = 1
function nextId() {
  return `fm-${_id++}`
}

type StoredMarket = FleaMarket & {
  is_deleted: boolean
  updated_at: string
  /** Opening hour rules stored alongside market for visibility checks */
  opening_hour_rules?: OpeningHourRule[]
}

/**
 * Mirrors the Postgres `is_market_visible()` function.
 * A market is visible if published, not deleted, AND either:
 *   - permanent, OR
 *   - has at least one future date rule (type='date', anchor_date >= today)
 */
function isMarketVisible(m: StoredMarket): boolean {
  if (m.published_at == null || m.is_deleted) return false
  if (m.is_permanent) return true
  const today = new Date().toISOString().slice(0, 10)
  return (m.opening_hour_rules ?? []).some(
    (r) => r.type === 'date' && r.anchor_date != null && r.anchor_date >= today,
  )
}

export function createInMemoryFleaMarkets(
  seed: StoredMarket[] = [],
  deps?: { profiles?: ProfileRepository },
): FleaMarketRepository {
  const store = new Map<string, StoredMarket>(seed.map((m) => [m.id, { ...m }]))

  return {
    async list(params) {
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 20
      const visible = Array.from(store.values()).filter(isMarketVisible)
      const total = visible.length
      const from = (page - 1) * pageSize
      const items = visible.slice(from, from + pageSize) as FleaMarket[]
      return { items, count: total }
    },

    async details(id) {
      const m = store.get(id)
      if (!m) throw new Error(`FleaMarket ${id} not found`)
      let organizerName = ''
      if (deps?.profiles) {
        try {
          const profile = await deps.profiles.get(m.organizer_id)
          organizerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
        } catch {
          // Profile not found — leave empty
        }
      }
      return {
        ...m,
        organizerName,
        opening_hour_rules: [],
        opening_hour_exceptions: [],
        flea_market_images: [],
      } as FleaMarketDetails
    },

    /**
     * @stub Returns empty array — not implemented for in-memory use.
     * Seam tests that call this will get a silent false-negative.
     * Provide real geo-filtered data via seed if you need to assert against results.
     */
    async nearBy(_params) {
      console.warn('[in-memory] nearBy() is a stub and always returns []. Seed the repo if you need results.')
      return [] as FleaMarketNearBy[]
    },

    async create(payload) {
      const id = nextId()
      const now = new Date().toISOString()
      const market: StoredMarket = {
        id,
        name: payload.name,
        description: payload.description,
        street: payload.address.street,
        zip_code: payload.address.zipCode,
        city: payload.address.city,
        country: payload.address.country,
        latitude: payload.address.location.latitude,
        longitude: payload.address.location.longitude,
        is_permanent: payload.isPermanent,
        organizer_id: payload.organizerId,
        auto_accept_bookings: payload.autoAcceptBookings ?? false,
        published_at: null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      } as StoredMarket
      store.set(id, market)
      return { id }
    },

    async update(id, payload) {
      const existing = store.get(id)
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, {
        ...existing,
        name: payload.name,
        description: payload.description,
        street: payload.address.street,
        zip_code: payload.address.zipCode,
        city: payload.address.city,
        country: payload.address.country,
        latitude: payload.address.location.latitude,
        longitude: payload.address.location.longitude,
        is_permanent: payload.isPermanent,
        updated_at: new Date().toISOString(),
      })
    },

    async delete(id) {
      const existing = store.get(id)
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, { ...existing, is_deleted: true })
    },

    async publish(id) {
      const existing = store.get(id)
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, { ...existing, published_at: new Date().toISOString() })
    },

    async unpublish(id) {
      const existing = store.get(id)
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, { ...existing, published_at: null })
    },

    async listByOrganizer(organizerId) {
      return Array.from(store.values())
        .filter((m) => m.organizer_id === organizerId && !m.is_deleted)
        .map((m) => ({ ...m, isVisible: isMarketVisible(m) })) as FleaMarket[]
    },
  }
}

/**
 * Creates an in-memory search adapter backed by a FleaMarketRepository.
 *
 * Previously accepted a private-Map getter from the flea-markets module,
 * which was hard to wire. Now accepts the repo interface directly so it can
 * be composed with any FleaMarketRepository implementation.
 */
export function createInMemorySearch(
  deps: { fleaMarkets: FleaMarketRepository },
): SearchRepository {
  return {
    async query(query) {
      const q = query.toLowerCase()
      const { items } = await deps.fleaMarkets.list({ pageSize: 1000 })
      const fleaMarkets = items
        .filter((m) => m.name.toLowerCase().includes(q))
        .slice(0, 20) as FleaMarket[]
      return { fleaMarkets } as SearchResult
    },
  }
}

export function createInMemoryMarketTables(seed: MarketTable[] = []): MarketTableRepository {
  const store = new Map<string, MarketTable>(seed.map((t) => [t.id, { ...t }]))
  let _tid = 1

  return {
    async list(fleaMarketId) {
      return Array.from(store.values()).filter(
        (t) => t.flea_market_id === fleaMarketId && t.is_available,
      )
    },

    async create(payload) {
      const id = `mt-${_tid++}`
      const table: MarketTable = {
        id,
        flea_market_id: payload.fleaMarketId,
        label: payload.label,
        description: payload.description ?? null,
        price_sek: payload.priceSek,
        size_description: payload.sizeDescription ?? null,
        is_available: true,
        max_per_day: 1,
        sort_order: store.size,
      } as MarketTable
      store.set(id, table)
      return { id }
    },

    async update(id, updates) {
      const existing = store.get(id)
      if (!existing) throw new Error(`MarketTable ${id} not found`)
      store.set(id, { ...existing, ...updates })
    },

    async delete(id) {
      store.delete(id)
    },
  }
}
