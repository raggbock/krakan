/**
 * Thin Nominatim geocoder. Returns { lat, lng } for the first result,
 * or throws if the address cannot be resolved.
 *
 * Nominatim usage policy: max 1 req/s, include a descriptive User-Agent.
 * Edge functions are invoked infrequently enough that this is fine.
 */
export async function geocodeAddress(
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lng: number }> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  const res = await fetchImpl(url.toString(), {
    headers: { 'User-Agent': 'Fyndstigen/1.0 (noreply@fyndstigen.se)' },
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)

  const results = (await res.json()) as Array<{ lat: string; lon: string }>
  if (!results.length) throw new Error(`geocode_no_results: ${address}`)

  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
}
