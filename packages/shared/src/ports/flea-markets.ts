/**
 * FleaMarket ports — repository interfaces for markets, market tables, and search.
 *
 * Three interfaces:
 *   - FleaMarketRepository  — full CRUD + publish + nearby/weekend-open queries.
 *   - MarketTableRepository — table-level CRUD (list, create, update, delete).
 *   - SearchRepository      — free-text search over markets and related entities.
 *
 * Implementations live in:
 *   adapters/supabase/flea-markets.ts  (production)
 *   adapters/in-memory/flea-markets.ts (tests)
 *
 * All methods are async; callers should expect Supabase errors to propagate as
 * thrown Error instances (not typed — wrap with toAppError if needed).
 */

import type {
  FleaMarket,
  FleaMarketDetails,
  MarketTable,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  SearchResult,
} from '../types'
import type { FleaMarketNearByView } from '../types/domain'
import type { Publishable } from './publishable'

export type WeekendOpenSlot = {
  fleaMarketId: string
  name: string
  city: string | null
  /** 0=Sun, 5=Fri, 6=Sat */
  dayOfWeek: number
  /** "HH:MM" */
  openTime: string
  /** "HH:MM" */
  closeTime: string
}

export interface FleaMarketRepository extends Publishable {
  list(params?: { page?: number; pageSize?: number }): Promise<{ items: FleaMarket[]; count: number }>
  details(id: string): Promise<FleaMarketDetails>
  nearBy(params: { latitude: number; longitude: number; radiusKm: number }): Promise<FleaMarketNearByView[]>
  create(payload: CreateFleaMarketPayload): Promise<{ id: string }>
  update(id: string, payload: UpdateFleaMarketPayload): Promise<void>
  delete(id: string): Promise<void>
  listByOrganizer(organizerId: string): Promise<FleaMarket[]>
  /**
   * Markets with weekly opening_hour_rules on Fri/Sat/Sun. One row per
   * (market × matching day). Excludes deleted and `status='closed'` markets.
   * Caller is responsible for sort + week-number arithmetic.
   */
  weekendOpen(): Promise<WeekendOpenSlot[]>
  /**
   * Ids of visible markets currently open right now (Stockholm local clock).
   * Backed by the markets_open_now() Postgres function.
   */
  openNowIds(): Promise<string[]>
}

export interface SearchRepository {
  query(query: string): Promise<SearchResult>
}

export interface MarketTableRepository {
  list(fleaMarketId: string): Promise<MarketTable[]>
  create(payload: CreateMarketTablePayload): Promise<{ id: string }>
  update(id: string, updates: Partial<MarketTable>): Promise<void>
  delete(id: string): Promise<void>
}
