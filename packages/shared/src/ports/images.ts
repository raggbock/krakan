import type { FleaMarketImage } from '../types'

/**
 * Port for flea-market image storage operations.
 *
 * Supabase adapter: delegates to `supabase.storage` (bucket: `flea-market-images`).
 * In-memory adapter: minimal stub backed by a Map — for tests.
 *
 * NOTE: `add` and `remove` consumers inside `runMarketMutation` / `use-submit-market`
 * still call `api.images` directly and will be migrated to this port in PR 8.
 */
export type ImagePort = {
  /**
   * Synchronous URL builder — returns the public Supabase Storage URL for a
   * stored object. No network request is made.
   */
  publicUrl(storagePath: string): string

  /**
   * Upload a File to the market's image folder, then persist the row via RPC.
   * Returns the inserted `flea_market_images` row.
   */
  add(marketId: string, file: File): Promise<FleaMarketImage>

  /**
   * Delete the DB row and best-effort remove the storage object.
   * DB deletion is authoritative; storage failure is logged but not thrown.
   */
  remove(image: FleaMarketImage): Promise<void>
}
