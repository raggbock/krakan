import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'
import type { GeocodeOutcome } from './bulk-geocode'
import type { MarketEditPatch } from './patch-builder'

export type GeocodeProgress = {
  total: number
  done: number
  current: AdminMarketRow | null
  succeeded: number
  failed: number
}

export async function runGeocodeSession(
  markets: AdminMarketRow[],
  geocodeFn: (markets: AdminMarketRow[], signal?: AbortSignal) => AsyncGenerator<GeocodeOutcome>,
  onProgress: (p: GeocodeProgress) => void,
  editFn: (id: string, patch: MarketEditPatch) => Promise<void>,
  signal?: AbortSignal,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0
  let done = 0

  const marketById = new Map(markets.map((m) => [m.id, m]))

  for await (const result of geocodeFn(markets, signal)) {
    done++
    const current = marketById.get(result.marketId) ?? null

    if (result.ok) {
      succeeded++
      await editFn(result.marketId, {
        location: { latitude: result.latitude, longitude: result.longitude },
      })
    } else {
      failed++
    }

    onProgress({ total: markets.length, done, current, succeeded, failed })
  }

  return { succeeded, failed }
}
