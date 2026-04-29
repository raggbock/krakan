import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deps } from './deps'
import type { FleaMarket, OpeningHourRule, UserProfile } from './types'
import type { StoredRoute } from './adapters/in-memory/routes'
import {
  createInMemoryFleaMarkets,
  createInMemoryMarketTables,
  createInMemorySearch,
  createE2EInMemoryFleaMarkets,
  type FleaMarketsControl,
} from './adapters/in-memory/flea-markets'
import { createInMemoryRoutes } from './adapters/in-memory/routes'
import { createInMemoryProfiles, createInMemoryOrganizers } from './adapters/in-memory/profiles'
import { createInMemoryAdmin } from './adapters/in-memory/admin'
import { createInMemoryBookings } from './adapters/in-memory/bookings'
import { createInMemoryStats } from './adapters/in-memory/stats'
import { createInMemoryImages } from './adapters/in-memory/images'
import {
  createSupabaseFleaMarkets,
  createSupabaseMarketTables,
  createSupabaseSearch,
} from './adapters/supabase/flea-markets'
import { createSupabaseRoutes } from './adapters/supabase/routes'
import { createSupabaseProfiles, createSupabaseOrganizers } from './adapters/supabase/profiles'
import { createSupabaseAdmin } from './adapters/supabase/admin'
import { createSupabaseBookings } from './adapters/supabase/bookings'
import { createSupabaseStats } from './adapters/supabase/stats'
import { createSupabaseImages } from './adapters/supabase/images'

type StoredMarket = FleaMarket & {
  is_deleted: boolean
  updated_at: string
  opening_hour_rules?: OpeningHourRule[]
}

export type { StoredRoute }

/**
 * In-memory Deps — for tests only.
 * Pass seed data as needed.
 */
export function makeInMemoryDeps(
  seed: StoredMarket[] = [],
  routes: StoredRoute[] = [],
  profiles: UserProfile[] = [],
): Deps {
  const fleaMarkets = createInMemoryFleaMarkets(seed)
  const marketTables = createInMemoryMarketTables()
  return {
    markets: fleaMarkets,
    marketTables,
    routes: createInMemoryRoutes(routes),
    profiles: createInMemoryProfiles(profiles),
    organizers: createInMemoryOrganizers(),
    admin: createInMemoryAdmin().repo,
    bookings: createInMemoryBookings(),
    stats: createInMemoryStats(),
    search: createInMemorySearch({ fleaMarkets }),
    images: createInMemoryImages(),
  }
}

/**
 * E2E-only Deps with runtime control handles. Tests seed/reset the store
 * after the Deps container has been constructed and wired into <DepsProvider>.
 * Do not import from production code paths.
 */
export type E2EControl = {
  markets: FleaMarketsControl
}

export function createE2EInMemoryDeps(): { deps: Deps; control: E2EControl } {
  const { repo: markets, control: marketsControl } = createE2EInMemoryFleaMarkets()
  return {
    deps: {
      markets,
      marketTables: createInMemoryMarketTables(),
      routes: createInMemoryRoutes([]),
      profiles: createInMemoryProfiles([]),
      organizers: createInMemoryOrganizers(),
      admin: createInMemoryAdmin().repo,
      bookings: createInMemoryBookings(),
      stats: createInMemoryStats(),
      search: createInMemorySearch({ fleaMarkets: markets }),
      images: createInMemoryImages(),
    },
    control: { markets: marketsControl },
  }
}

export type MakeSupabaseDepsOptions = {
  /**
   * Optional image compression hook. The web layer injects `compressImage`
   * from `web/src/lib/compress-image.ts`; callers without a DOM (tests,
   * Deno edge functions) can omit it and files are uploaded untouched.
   */
  compressImage?: (file: File) => Promise<File>
}

/**
 * Supabase-backed Deps — for the browser app.
 * Construct ONCE per app mount (e.g. inside QueryProvider or DepsProvider).
 */
export function makeSupabaseDeps(supabase: SupabaseClient, options: MakeSupabaseDepsOptions = {}): Deps {
  return {
    markets: createSupabaseFleaMarkets(supabase),
    marketTables: createSupabaseMarketTables(supabase),
    routes: createSupabaseRoutes(supabase),
    profiles: createSupabaseProfiles(supabase),
    organizers: createSupabaseOrganizers(supabase),
    admin: createSupabaseAdmin(supabase),
    bookings: createSupabaseBookings(supabase),
    stats: createSupabaseStats(supabase),
    search: createSupabaseSearch(supabase),
    images: createSupabaseImages({ supabase, compress: options.compressImage }),
  }
}
