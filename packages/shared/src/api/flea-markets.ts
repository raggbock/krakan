import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseFleaMarkets, createSupabaseSearch, createSupabaseMarketTables } from '../adapters/supabase/flea-markets'

/**
 * Creates the flea-markets, search, and marketTables API namespaces.
 * Internally delegates to the Supabase adapters; the outer shape is
 * preserved for back-compat with existing callers.
 */
export function createFleaMarketsApi(supabase: SupabaseClient) {
  const fleaMarketsRepo = createSupabaseFleaMarkets(supabase)
  const searchRepo = createSupabaseSearch(supabase)
  const tablesRepo = createSupabaseMarketTables(supabase)

  return {
    fleaMarkets: {
      list: fleaMarketsRepo.list.bind(fleaMarketsRepo),
      details: fleaMarketsRepo.details.bind(fleaMarketsRepo),
      nearBy: fleaMarketsRepo.nearBy.bind(fleaMarketsRepo),
      create: fleaMarketsRepo.create.bind(fleaMarketsRepo),
      update: fleaMarketsRepo.update.bind(fleaMarketsRepo),
      delete: fleaMarketsRepo.delete.bind(fleaMarketsRepo),
      publish: fleaMarketsRepo.publish.bind(fleaMarketsRepo),
      unpublish: fleaMarketsRepo.unpublish.bind(fleaMarketsRepo),
      listByOrganizer: fleaMarketsRepo.listByOrganizer.bind(fleaMarketsRepo),
    },

    search: {
      query: searchRepo.query.bind(searchRepo),
    },

    marketTables: {
      list: tablesRepo.list.bind(tablesRepo),
      create: tablesRepo.create.bind(tablesRepo),
      update: tablesRepo.update.bind(tablesRepo),
      delete: tablesRepo.delete.bind(tablesRepo),
    },
  }
}
