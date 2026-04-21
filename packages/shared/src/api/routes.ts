import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseRoutes } from '../adapters/supabase/routes'

/**
 * Creates the routes API namespace.
 * Internally delegates to the Supabase adapter; the outer shape is
 * preserved for back-compat with existing callers.
 */
export function createRoutesApi(supabase: SupabaseClient) {
  const routesRepo = createSupabaseRoutes(supabase)

  return {
    routes: {
      create: routesRepo.create.bind(routesRepo),
      get: routesRepo.get.bind(routesRepo),
      update: routesRepo.update.bind(routesRepo),
      delete: routesRepo.delete.bind(routesRepo),
      publish: routesRepo.publish.bind(routesRepo),
      unpublish: routesRepo.unpublish.bind(routesRepo),
      listByUser: routesRepo.listByUser.bind(routesRepo),
      listPopular: routesRepo.listPopular.bind(routesRepo),
    },
  }
}
