import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAuth } from './supabase-auth'
import { createSupabaseServerData } from './supabase-server'
import { createSupabaseFleaMarkets, createSupabaseSearch, createSupabaseMarketTables } from './supabase/flea-markets'
import { createSupabaseBookings } from './supabase/bookings'
import { createSupabaseRoutes } from './supabase/routes'
import { createSupabaseProfiles, createSupabaseOrganizers } from './supabase/profiles'
import type { AuthPort } from '../ports/auth'
import type { ServerDataPort } from '../ports/server'
import type { FleaMarketRepository, SearchRepository, MarketTableRepository } from '../ports/flea-markets'
import type { BookingRepository } from '../ports/bookings'
import type { RouteRepository } from '../ports/routes'
import type { ProfileRepository, OrganizerRepository } from '../ports/profiles'

export { createSupabaseAuth } from './supabase-auth'
export { createSupabaseServerData } from './supabase-server'
export { createSupabaseFleaMarkets, createSupabaseSearch, createSupabaseMarketTables } from './supabase/flea-markets'
export { createSupabaseBookings } from './supabase/bookings'
export { createSupabaseRoutes } from './supabase/routes'
export { createSupabaseProfiles, createSupabaseOrganizers } from './supabase/profiles'

export function createSupabaseAdapters(supabase: SupabaseClient): {
  auth: AuthPort
  server: ServerDataPort
  fleaMarkets: FleaMarketRepository
  search: SearchRepository
  marketTables: MarketTableRepository
  bookings: BookingRepository
  routes: RouteRepository
  profiles: ProfileRepository
  organizers: OrganizerRepository
} {
  return {
    auth: createSupabaseAuth(supabase),
    server: createSupabaseServerData(supabase),
    fleaMarkets: createSupabaseFleaMarkets(supabase),
    search: createSupabaseSearch(supabase),
    marketTables: createSupabaseMarketTables(supabase),
    bookings: createSupabaseBookings(supabase),
    routes: createSupabaseRoutes(supabase),
    profiles: createSupabaseProfiles(supabase),
    organizers: createSupabaseOrganizers(supabase),
  }
}
