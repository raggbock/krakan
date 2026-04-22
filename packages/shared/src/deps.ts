import type { FleaMarketRepository, MarketTableRepository } from './ports/flea-markets'

/**
 * Dependency container for the Fyndstigen app.
 *
 * Pilot scope: `markets` and `marketTables` — `marketTables` rides along
 * because `useMarketDetails` reads both in one hook and a half-migrated
 * surface would be worse than either leaving the whole hook or doing both.
 * `SearchRepository` stays on the old `api.*` surface until its consumer
 * hook is actually migrated.
 * Add slots as features migrate (bookings, routes, profiles, payment, telemetry).
 */
export type Deps = {
  markets: FleaMarketRepository
  marketTables: MarketTableRepository
}
