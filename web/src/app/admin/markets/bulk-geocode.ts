/**
 * Bulk-geocode helper — paces Nominatim calls to honour the public 1 req/s
 * rate limit, then streams back per-row results so the UI can render progress.
 */

import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'

export type GeocodeOutcome =
  | { marketId: string; ok: true; latitude: number; longitude: number }
  | { marketId: string; ok: false; reason: string }

const NOMINATIM_DELAY_MS = 1100

export async function* bulkGeocode(
  markets: AdminMarketRow[],
  signal?: AbortSignal,
): AsyncGenerator<GeocodeOutcome> {
  for (let i = 0; i < markets.length; i++) {
    if (signal?.aborted) return
    const m = markets[i]
    const query = buildQuery(m)
    if (!query) {
      yield { marketId: m.id, ok: false, reason: 'no_address' }
      continue
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=se&limit=1`,
        { signal, headers: { 'Accept-Language': 'sv' } },
      )
      if (!res.ok) {
        yield { marketId: m.id, ok: false, reason: `http_${res.status}` }
      } else {
        const arr = (await res.json()) as Array<{ lat: string; lon: string }>
        if (arr.length === 0) {
          yield { marketId: m.id, ok: false, reason: 'no_match' }
        } else {
          yield {
            marketId: m.id,
            ok: true,
            latitude: parseFloat(arr[0].lat),
            longitude: parseFloat(arr[0].lon),
          }
        }
      }
    } catch (err) {
      yield {
        marketId: m.id,
        ok: false,
        reason: err instanceof Error ? err.message : 'fetch_failed',
      }
    }

    // Pace — skip the trailing delay after the last item.
    if (i < markets.length - 1) {
      await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS))
    }
  }
}

function buildQuery(m: AdminMarketRow): string | null {
  const parts: string[] = []
  if (m.street) parts.push(m.street)
  if (m.zipCode) parts.push(m.zipCode)
  if (m.city) parts.push(m.city)
  if (parts.length === 0) return null
  return parts.join(', ')
}
