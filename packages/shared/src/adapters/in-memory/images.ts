import type { FleaMarketImageView } from '../../types'
import type { ImagePort } from '../../ports/images'

/**
 * In-memory ImagePort stub — for tests only.
 *
 * - `publicUrl` returns a deterministic fake URL (`https://in-memory/<storagePath>`).
 * - `add` stores a synthetic row in an internal Map keyed by storagePath.
 * - `remove` deletes the entry from the Map.
 *
 * No actual file content is retained; the File object is discarded after
 * recording its metadata. This is sufficient for unit tests that only need
 * to assert that the port was called with the right arguments.
 */
export function createInMemoryImages(): ImagePort {
  const store = new Map<string, FleaMarketImageView>()
  let _id = 1

  return {
    publicUrl(storagePath: string): string {
      return `https://in-memory/${storagePath}`
    },

    async add(marketId: string, file: File): Promise<FleaMarketImageView> {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const storagePath = `${marketId}/in-memory-${_id}.${ext}`
      const view: FleaMarketImageView = {
        id: `img-${_id++}`,
        storagePath,
        sortOrder: store.size,
      }
      store.set(storagePath, view)
      return { ...view }
    },

    async remove(image: FleaMarketImageView): Promise<void> {
      store.delete(image.storagePath)
    },
  }
}
