import type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  MarketTable,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  SearchResult,
} from '../../types'
import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from '../../ports/flea-markets'

let _id = 1
function nextId() {
  return `fm-${_id++}`
}

type StoredMarket = FleaMarket & { is_deleted: boolean; updated_at: string }

export function createInMemoryFleaMarkets(
  seed: StoredMarket[] = [],
): FleaMarketRepository {
  const store = new Map<string, StoredMarket>(seed.map((m) => [m.id, { ...m }]))

  return {
    async list(params) {
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 20
      const visible = Array.from(store.values()).filter(
        (m) => m.published_at != null && !m.is_deleted,
      )
      const total = visible.length
      const from = (page - 1) * pageSize
      const items = visible.slice(from, from + pageSize) as FleaMarket[]
      return { items, count: total }
    },

    async details(id) {
      const m = store.get(id)
      if (!m) throw new Error(`FleaMarket ${id} not found`)
      return {
        ...m,
        organizerName: '',
        opening_hour_rules: [],
        opening_hour_exceptions: [],
        flea_market_images: [],
      } as FleaMarketDetails
    },

    async nearBy(_params) {
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
      return Array.from(store.values()).filter(
        (m) => m.organizer_id === organizerId && !m.is_deleted,
      ) as FleaMarket[]
    },
  }
}

export function createInMemorySearch(
  getFleaMarkets: () => Map<string, StoredMarket>,
): SearchRepository {
  return {
    async query(query) {
      const q = query.toLowerCase()
      const fleaMarkets = Array.from(getFleaMarkets().values())
        .filter((m) => m.published_at != null && !m.is_deleted && m.name.toLowerCase().includes(q))
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
