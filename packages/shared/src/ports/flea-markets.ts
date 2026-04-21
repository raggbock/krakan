import type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  MarketTable,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateMarketTablePayload,
  SearchResult,
} from '../types'
import type { Publishable } from './publishable'

export interface FleaMarketRepository extends Publishable {
  list(params?: { page?: number; pageSize?: number }): Promise<{ items: FleaMarket[]; count: number }>
  details(id: string): Promise<FleaMarketDetails>
  nearBy(params: { latitude: number; longitude: number; radiusKm: number }): Promise<FleaMarketNearBy[]>
  create(payload: CreateFleaMarketPayload): Promise<{ id: string }>
  update(id: string, payload: UpdateFleaMarketPayload): Promise<void>
  delete(id: string): Promise<void>
  listByOrganizer(organizerId: string): Promise<FleaMarket[]>
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
