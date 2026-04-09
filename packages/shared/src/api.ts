import type { SupabaseClient } from '@supabase/supabase-js'
import { createFleaMarketsApi } from './api/flea-markets'
import { createBookingsApi } from './api/bookings'
import { createRoutesApi } from './api/routes'
import { createProfilesApi } from './api/profiles'

export function createApi(supabase: SupabaseClient) {
  return {
    ...createFleaMarketsApi(supabase),
    ...createBookingsApi(supabase),
    ...createRoutesApi(supabase),
    ...createProfilesApi(supabase),
  }
}

export type Api = ReturnType<typeof createApi>
