import type { SupabaseClient } from '@supabase/supabase-js'
import { createFleaMarketsApi } from './api/flea-markets'
import { createBookingsApi } from './api/bookings'
import { createRoutesApi } from './api/routes'
import { createProfilesApi } from './api/profiles'
import { createImageService } from './api/images'

export type CreateApiOptions = {
  /**
   * Optional compression hook invoked inside `api.images.add(...)` before
   * the blob is uploaded. The web layer wires in `compressImage` from
   * `web/src/lib/compress-image.ts`; callers without a DOM (tests,
   * Deno edge functions) can omit it and the file is uploaded untouched.
   */
  compressImage?: (file: File) => Promise<File>
}

export function createApi(supabase: SupabaseClient, options: CreateApiOptions = {}) {
  return {
    ...createFleaMarketsApi(supabase),
    ...createBookingsApi(supabase),
    ...createRoutesApi(supabase),
    ...createProfilesApi(supabase),
    images: createImageService({ supabase, compress: options.compressImage }),
  }
}

export type Api = ReturnType<typeof createApi>
