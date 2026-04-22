import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from './ports/flea-markets'

/**
 * Dependency container for the Fyndstigen app.
 *
 * Start minimal — only `markets` is wired today.
 * Add slots when the corresponding feature migrates (bookings, routes, profiles, payment, telemetry).
 */
export type Deps = {
  markets: FleaMarketRepository
  search: SearchRepository
  marketTables: MarketTableRepository
}
