import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseProfiles, createSupabaseOrganizers } from '../adapters/supabase/profiles'

/**
 * Creates the profiles and organizers API namespaces.
 * Internally delegates to the Supabase adapters; the outer shape is
 * preserved for back-compat with existing callers.
 */
export function createProfilesApi(supabase: SupabaseClient) {
  const profilesRepo = createSupabaseProfiles(supabase)
  const organizersRepo = createSupabaseOrganizers(supabase)

  return {
    profiles: {
      get: profilesRepo.get.bind(profilesRepo),
      update: profilesRepo.update.bind(profilesRepo),
    },

    organizers: {
      get: organizersRepo.get.bind(organizersRepo),
      update: organizersRepo.update.bind(organizersRepo),
      stats: organizersRepo.stats.bind(organizersRepo),
    },
  }
}
