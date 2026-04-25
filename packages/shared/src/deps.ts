import type { FleaMarketRepository, MarketTableRepository } from './ports/flea-markets'
import type { RouteRepository } from './ports/routes'
import type { ProfileRepository } from './ports/profiles'
import type { AdminPort } from './ports/admin'
import type { BookingRepository } from './ports/bookings'
import type { StatsPort } from './ports/stats'

/**
 * Dependency container for the Fyndstigen app.
 *
 * Migrated surfaces: markets, marketTables, routes, profiles, admin, bookings.
 * `SearchRepository` and `bookingService` (booking.create + payment/capture)
 * stay on the old `api.*` surface until their consumer hooks are migrated.
 * Add slots as features migrate (payment gateway, telemetry).
 */
export type Deps = {
  markets: FleaMarketRepository
  marketTables: MarketTableRepository
  routes: RouteRepository
  profiles: ProfileRepository
  admin: AdminPort
  bookings: BookingRepository
  stats: StatsPort
}
