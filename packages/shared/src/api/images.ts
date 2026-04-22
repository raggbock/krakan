import type { SupabaseClient } from '@supabase/supabase-js'
import type { FleaMarketImage } from '../types'

const BUCKET = 'flea-market-images'

export type ImageService = {
  add(marketId: string, file: File): Promise<FleaMarketImage>
  remove(image: FleaMarketImage): Promise<void>
  publicUrl(storagePath: string): string
}

export type ImageServiceDeps = {
  supabase: SupabaseClient
  /**
   * Optional compression hook. The shared package cannot import from `web/`,
   * so the web layer injects `compressImage` at construction time. When
   * omitted (e.g. in tests or server-side callers), the file is uploaded
   * untouched.
   */
  compress?: (file: File) => Promise<File>
}

export function createImageService(deps: ImageServiceDeps): ImageService {
  const { supabase, compress } = deps

  return {
    async add(marketId: string, file: File): Promise<FleaMarketImage> {
      const toUpload = compress ? await compress(file) : file
      const ext = toUpload.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${marketId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, toUpload)
      if (uploadError) throw uploadError

      // Atomic INSERT ... SELECT coalesce(max(sort_order), -1) + 1 — executed
      // as a single statement via RPC so two concurrent adds can't collide on
      // the same sort_order.
      const { data, error } = await supabase.rpc('insert_flea_market_image', {
        p_flea_market_id: marketId,
        p_storage_path: path,
      })

      if (error) {
        // Rescue the orphan blob. We re-throw the original DB error — the
        // storage cleanup is best-effort and its failure shouldn't mask the
        // real cause.
        try {
          await supabase.storage.from(BUCKET).remove([path])
        } catch {
          // swallow — see above
        }
        throw error
      }

      // RPC returns the inserted row (supabase-js wraps a single row result
      // as either the object directly or a 1-element array depending on the
      // function signature — we accept both).
      const row = Array.isArray(data) ? data[0] : data
      return {
        id: row.id,
        storage_path: row.storage_path,
        sort_order: row.sort_order,
      }
    },

    async remove(image: FleaMarketImage): Promise<void> {
      // DB-first: delete the row before touching storage. If the DB delete
      // fails the blob is still intact — safe failure with no broken image.
      const { error } = await supabase
        .from('flea_market_images')
        .delete()
        .eq('id', image.id)
      if (error) throw error

      // Storage removal is best-effort. If it fails the DB row is already gone
      // (source of truth is correct) and the orphaned blob can be swept later.
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([image.storage_path])
      if (storageErr) {
        console.warn('[ImageService] orphaned storage blob:', image.storage_path, storageErr)
      }
    },

    publicUrl(storagePath: string): string {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      return data.publicUrl
    },
  }
}
