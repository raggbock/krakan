import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deps } from './deps'
import type { FleaMarket, OpeningHourRule } from './types'
import {
  createInMemoryFleaMarkets,
  createInMemoryMarketTables,
} from './adapters/in-memory/flea-markets'
import {
  createSupabaseFleaMarkets,
  createSupabaseMarketTables,
} from './adapters/supabase/flea-markets'

type StoredMarket = FleaMarket & {
  is_deleted: boolean
  updated_at: string
  opening_hour_rules?: OpeningHourRule[]
}

/**
 * In-memory Deps — for tests only.
 * Pass seed data as needed; all adapters share the same in-memory flea-markets store.
 */
export function makeInMemoryDeps(seed: StoredMarket[] = []): Deps {
  const fleaMarkets = createInMemoryFleaMarkets(seed)
  const marketTables = createInMemoryMarketTables()
  return { markets: fleaMarkets, marketTables }
}

/**
 * Supabase-backed Deps — for the browser app.
 * Construct ONCE per app mount (e.g. inside QueryProvider or DepsProvider).
 */
export function makeSupabaseDeps(supabase: SupabaseClient): Deps {
  return {
    markets: createSupabaseFleaMarkets(supabase),
    marketTables: createSupabaseMarketTables(supabase),
  }
}
