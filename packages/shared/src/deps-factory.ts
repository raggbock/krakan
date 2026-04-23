import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deps } from './deps'
import type { FleaMarket, OpeningHourRule, UserProfile } from './types'
import type { StoredRoute } from './adapters/in-memory/routes'
import {
  createInMemoryFleaMarkets,
  createInMemoryMarketTables,
} from './adapters/in-memory/flea-markets'
import { createInMemoryRoutes } from './adapters/in-memory/routes'
import { createInMemoryProfiles } from './adapters/in-memory/profiles'
import {
  createSupabaseFleaMarkets,
  createSupabaseMarketTables,
} from './adapters/supabase/flea-markets'
import { createSupabaseRoutes } from './adapters/supabase/routes'
import { createSupabaseProfiles } from './adapters/supabase/profiles'

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
  }
}

/**
 * Supabase-backed Deps — for the browser app.
 * Construct ONCE per app mount (e.g. inside QueryProvider or DepsProvider).
 */
export function makeSupabaseDeps(supabase: SupabaseClient): Deps {
  return {
    markets: createSupabaseFleaMarkets(supabase),
    marketTables: createSupabaseMarketTables(supabase),
    routes: createSupabaseRoutes(supabase),
    profiles: createSupabaseProfiles(supabase),
  }
}
