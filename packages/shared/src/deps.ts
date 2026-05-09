/**
 * Deps — the dependency container for all production I/O ports.
 *
 * Every React hook that needs data calls `useDeps()` to receive this object.
 * Domain sagas (market-mutation, route-mutation) receive it as a constructor
 * argument so tests can inject in-memory stubs without touching the DOM.
 *
 * Migration note (quirk #1 in ARCHITECTURE.md): booking creation and payment
 * still go through the legacy `api.*` surface inside booking-service.ts.
 * The `bookingService` field is intentionally absent here until that migration
 * is complete. All other surfaces are on `Deps`.
 *
 * See deps-factory.ts for `makeSupabaseDeps` (production) and
 * `makeInMemoryDeps` / `createE2EInMemoryDeps` (tests / E2E).
 */

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
