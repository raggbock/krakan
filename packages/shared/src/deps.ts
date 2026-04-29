import type { FleaMarketRepository, MarketTableRepository, SearchRepository } from './ports/flea-markets'
import type { RouteRepository } from './ports/routes'
import type { ProfileRepository, OrganizerRepository } from './ports/profiles'
import type { AdminPort } from './ports/admin'
import type { BookingRepository } from './ports/bookings'
import type { StatsPort } from './ports/stats'

/**
 * Dependency container for the Fyndstigen app.
 *
 * Migrated surfaces: markets, marketTables, routes, profiles, organizers, admin, bookings, search.
 * `bookingService` (booking.create + payment/capture) stays on the old `api.*` surface until
 * its consumer hooks are migrated.
 * Add slots as features migrate (payment gateway, telemetry).
 */
export type Deps = {
  markets: FleaMarketRepository
  marketTables: MarketTableRepository
  routes: RouteRepository
  profiles: ProfileRepository
  organizers: OrganizerRepository
  admin: AdminPort
  bookings: BookingRepository
  stats: StatsPort
  search: SearchRepository
}
