import type { SupabaseClient } from '@supabase/supabase-js'
import { createFleaMarketsApi } from './flea-markets'
import { createBookingsApi } from './bookings'
import { createRoutesApi } from './routes'
import { createProfilesApi } from './profiles'
import { createImageService } from './images'
import { createEdgeApi } from './edge'

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
    ...createEdgeApi(supabase),
    images: createImageService({ supabase, compress: options.compressImage }),
  }
}

export type Api = ReturnType<typeof createApi>
