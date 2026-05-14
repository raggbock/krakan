/**
 * In-memory adapter for FleaMarketRepository, MarketTableRepository, and
 * SearchRepository — test doubles.
 *
 * Two factory variants:
 *   - createInMemoryFleaMarkets(seed) — standard; private store.
 *   - createE2EInMemoryFleaMarkets()  — E2E; returns { repo, control } so
 *       Playwright tests can mutate the store via window.__e2eBridge__ after
 *       the DepsProvider has been mounted.
 *
 * Visibility logic mirrors the Postgres `is_market_visible()` function:
 * published + not-deleted + (permanent OR has a future date-type rule).
 * Non-atomic: synchronous Map mutations; safe for single-process tests only.
 */

import type {
  FleaMarketView,
  FleaMarketDetailsView,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  SearchResult,
} from '../../types'
import type { FleaMarketNearByView, MarketTableView, OpeningHourRuleView, OpeningHourExceptionView, FleaMarketImageView } from '../../types/domain'
import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from '../../ports/flea-markets'
import type { ProfileRepository } from '../../ports/profiles'

let _id = 1
function nextId() {
  return `fm-${_id++}`
}

export type StoredMarket = FleaMarketView & {
  isDeleted: boolean
  updatedAt: string
  /** Opening hour rules stored alongside market for visibility checks */
  openingHourRules?: OpeningHourRuleView[]
}

/**
 * Mirrors the Postgres `is_market_visible()` function.
 * A market is visible if published, not deleted, AND either:
 *   - permanent, OR
 *   - has at least one future date rule (type='date', anchor_date >= today)
 */
function isMarketVisible(m: StoredMarket): boolean {
  if (m.publishedAt == null || m.isDeleted) return false
  if (m.isPermanent) return true
  const today = new Date().toISOString().slice(0, 10)
  return (m.openingHourRules ?? []).some(
    (r) => r.type === 'date' && r.anchorDate != null && r.anchorDate >= today,
  )
}

/**
 * Internal — builds an FleaMarketRepository over a caller-supplied store.
 * Used by both the standard in-memory factory (private store) and the E2E
 * factory (store owned by a control handle so tests can mutate at runtime).
 */
function buildRepo(
  store: Map<string, StoredMarket>,
  deps?: { profiles?: ProfileRepository },
): FleaMarketRepository {
  return {
    async list(params) {
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 20
      const visible = Array.from(store.values()).filter(isMarketVisible)
      const total = visible.length
      const from = (page - 1) * pageSize
      const items = visible.slice(from, from + pageSize) as FleaMarketView[]
      return { items, count: total }
    },

    async details(id) {
      const m = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!m) throw new Error(`FleaMarket ${id} not found`)
      let organizerName = ''
      if (deps?.profiles) {
        try {
          const profile = await deps.profiles.get(m.organizerId)
          organizerName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
        } catch {
          // Profile not found — leave empty
        }
      }
      const result: FleaMarketDetailsView = {
        ...m,
        organizerName,
        organizerSubscriptionTier: 0,
        openingHourRules: (m.openingHourRules ?? []) as OpeningHourRuleView[],
        openingHourExceptions: [] as OpeningHourExceptionView[],
        images: [] as FleaMarketImageView[],
      }
      return result
    },

    /**
     * @stub Returns empty array — not implemented for in-memory use.
     * Seam tests that call this will get a silent false-negative.
     * Provide real geo-filtered data via seed if you need to assert against results.
     */
    async nearBy(_params) {
      console.warn('[in-memory] nearBy() is a stub and always returns []. Seed the repo if you need results.')
      return [] as FleaMarketNearByView[]
    },

    async create(payload) {
      const id = nextId()
      const now = new Date().toISOString()
      const market: StoredMarket = {
        id,
        name: payload.name,
        description: payload.description,
        street: payload.address.street,
        zipCode: payload.address.zipCode,
        city: payload.address.city,
        country: payload.address.country,
        latitude: payload.address.location.latitude,
        longitude: payload.address.location.longitude,
        isPermanent: payload.isPermanent,
        organizerId: payload.organizerId,
        autoAcceptBookings: payload.autoAcceptBookings ?? false,
        contactWebsite: payload.contactWebsite ?? null,
        contactPhone: payload.contactPhone ?? null,
        contactEmail: payload.contactEmail ?? null,
        contactInstagram: payload.contactInstagram ?? null,
        contactFacebook: payload.contactFacebook ?? null,
        publishedAt: null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      }
      store.set(id, market)
      return { id }
    },

    async update(id, payload) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`FleaMarket ${id} not found`)

      // Snapshot previous rules so we can restore on failure (mirrors the
      // atomic Postgres function used in the real adapter).
      const previousRules = existing.openingHourRules

      // Validate new rules before mutating — all-or-nothing like the RPC.
      const newRules: OpeningHourRuleView[] = (payload.openingHours ?? []).map((oh, i) => {
        if (!oh.openTime || !oh.closeTime) {
          throw new Error(`Opening hour rule at index ${i} is missing openTime or closeTime`)
        }
        return {
          id: `ohr-${id}-${i}`,
          type: oh.type,
          dayOfWeek: oh.dayOfWeek ?? null,
          anchorDate: oh.anchorDate ?? null,
          openTime: oh.openTime,
          closeTime: oh.closeTime,
        }
      })

      try {
        const contactPatch: Partial<StoredMarket> = {}
        if (payload.contactWebsite !== undefined) contactPatch.contactWebsite = payload.contactWebsite
        if (payload.contactPhone !== undefined) contactPatch.contactPhone = payload.contactPhone
        if (payload.contactEmail !== undefined) contactPatch.contactEmail = payload.contactEmail
        if (payload.contactInstagram !== undefined) contactPatch.contactInstagram = payload.contactInstagram
        if (payload.contactFacebook !== undefined) contactPatch.contactFacebook = payload.contactFacebook
        store.set(id, {
          ...existing,
          name: payload.name,
          description: payload.description,
          street: payload.address.street,
          zipCode: payload.address.zipCode,
          city: payload.address.city,
          country: payload.address.country,
          latitude: payload.address.location.latitude,
          longitude: payload.address.location.longitude,
          isPermanent: payload.isPermanent,
          openingHourRules: newRules,
          updatedAt: new Date().toISOString(),
          ...contactPatch,
        })
      } catch (err) {
        // Restore previous state on failure.
        store.set(id, { ...existing, openingHourRules: previousRules })
        throw err
      }
    },

    async delete(id) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, { ...existing, isDeleted: true })
    },

    async publish(id) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, { ...existing, publishedAt: new Date().toISOString() })
    },

    async unpublish(id) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`FleaMarket ${id} not found`)
      store.set(id, { ...existing, publishedAt: null })
    },

    async listByOrganizer(organizerId) {
      return Array.from(store.values())
        .filter((m) => m.organizerId === organizerId && !m.isDeleted)
        .map((m) => ({ ...m, isVisible: isMarketVisible(m) })) as FleaMarketView[]
    },

    async weekendOpen() {
      // The in-memory store doesn't carry opening_hour_rules in a queryable
      // shape. Tests that need this surface should override the method on the
      // returned port. Returning [] is the safe default — no markets surface
      // as weekend-open in tests that don't seed it.
      return []
    },

    async openNowIds() {
      return []
    },
  }
}

export function createInMemoryFleaMarkets(
  seed: StoredMarket[] = [],
  deps?: { profiles?: ProfileRepository },
): FleaMarketRepository {
  const store = new Map<string, StoredMarket>(seed.map((m) => [m.id, { ...m }]))
  return buildRepo(store, deps)
}

/**
 * Runtime-controllable in-memory flea-markets — for E2E browser tests that
 * need to seed/reset the store AFTER the Deps container has been constructed.
 * Do not use in production paths.
 */
export type FleaMarketsControl = {
  seed(markets: StoredMarket[]): void
  reset(): void
}

export function createE2EInMemoryFleaMarkets(
  deps?: { profiles?: ProfileRepository },
): { repo: FleaMarketRepository; control: FleaMarketsControl } {
  const store = new Map<string, StoredMarket>()
  const control: FleaMarketsControl = {
    seed(markets) {
      store.clear()
      for (const m of markets) store.set(m.id, { ...m })
    },
    reset() {
      store.clear()
    },
  }
  return { repo: buildRepo(store, deps), control }
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
        .slice(0, 20)
      return { fleaMarkets } satisfies SearchResult
    },
  }
}

export function createInMemoryMarketTables(seed: MarketTableView[] = []): MarketTableRepository {
  const store = new Map<string, MarketTableView>(seed.map((t) => [t.id, { ...t }]))
  let _tid = 1

  return {
    async list(fleaMarketId) {
      return Array.from(store.values()).filter(
        (t) => t.fleaMarketId === fleaMarketId && t.isAvailable,
      )
    },

    async create(payload) {
      const id = `mt-${_tid++}`
      const table: MarketTableView = {
        id,
        fleaMarketId: payload.fleaMarketId,
        label: payload.label,
        description: payload.description ?? null,
        priceSek: payload.priceSek,
        sizeDescription: payload.sizeDescription ?? null,
        isAvailable: true,
        maxPerDay: 1,
        sortOrder: store.size,
      }
      store.set(id, table)
      return { id }
    },

    async update(id, updates) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`MarketTable ${id} not found`)
      store.set(id, { ...existing, ...updates })
    },

    async delete(id) {
      store.delete(id)
    },
  }
}
