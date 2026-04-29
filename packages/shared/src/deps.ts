import type { FleaMarketRepository, MarketTableRepository, SearchRepository } from './ports/flea-markets'
import type { RouteRepository } from './ports/routes'
import type { ProfileRepository, OrganizerRepository } from './ports/profiles'
import type { AdminPort } from './ports/admin'
import type { BookingRepository } from './ports/bookings'
import type { StatsPort } from './ports/stats'
import type { ImagePort } from './ports/images'

/**
 * Dependency container for the Fyndstigen app.
 *
 * Migrated surfaces: markets, marketTables, routes, profiles, organizers, admin, bookings, search, images.
 * `bookingService` (booking.create + payment/capture) stays on the old `api.*` surface until
 * its consumer hooks are migrated.
 * NOTE: `images.add` and `images.remove` callers in `runMarketMutation` / `use-submit-market`
 * still call `api.images` directly and will be migrated to `deps.images` in PR 8.
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
  images: ImagePort
}
