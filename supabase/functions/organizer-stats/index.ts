import { createHandler, ForbiddenError, HttpError } from '../_shared/handler.ts'

createHandler(async ({ user, admin, body }) => {
  const { organizer_id } = body as { organizer_id?: string }

  if (!organizer_id) {
    throw new HttpError(400, 'Missing required field: organizer_id')
  }

  if (user.id !== organizer_id) {
    throw new ForbiddenError('You can only view your own stats')
  }

  // Get organizer's flea markets
  const { data: markets, error: marketsErr } = await admin
    .from('flea_markets')
    .select('id, name')
    .eq('organizer_id', organizer_id)
    .eq('is_deleted', false)

  if (marketsErr) throw new Error('Failed to fetch markets')
  if (!markets || markets.length === 0) return { markets: [] }

  const posthogKey = Deno.env.get('POSTHOG_PRIVATE_API_KEY')
  const posthogHost = Deno.env.get('POSTHOG_HOST') || 'https://eu.i.posthog.com'
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')

  const marketIds = markets.map((m: { id: string }) => m.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Default: all zeros
  const statsMap = new Map<string, { pageviews_30d: number; pageviews_total: number; bookings_initiated_30d: number }>()
  for (const m of markets) {
    statsMap.set(m.id, { pageviews_30d: 0, pageviews_total: 0, bookings_initiated_30d: 0 })
  }

  // 3 batched HogQL queries (instead of 3×N individual queries)
  if (posthogKey && projectId) {
    const urlPatterns = marketIds.map((id: string) => `/fleamarkets/${id}`)

    const [pv30d, pvTotal, bi30d] = await Promise.all([
      batchHogQL(posthogHost, posthogKey, projectId, {
        query: `
          SELECT
            replaceRegexpOne(properties.$current_url, '.*(/fleamarkets/[^/?#]+).*', '\\\\1') as market_path,
            count() as cnt
          FROM events
          WHERE event = '$pageview'
            AND properties.$current_url LIKE '%/fleamarkets/%'
            AND timestamp >= '${thirtyDaysAgo}'
          GROUP BY market_path
        `,
      }),
      batchHogQL(posthogHost, posthogKey, projectId, {
        query: `
          SELECT
            replaceRegexpOne(properties.$current_url, '.*(/fleamarkets/[^/?#]+).*', '\\\\1') as market_path,
            count() as cnt
          FROM events
          WHERE event = '$pageview'
            AND properties.$current_url LIKE '%/fleamarkets/%'
          GROUP BY market_path
        `,
      }),
      batchHogQL(posthogHost, posthogKey, projectId, {
        query: `
          SELECT
            properties.flea_market_id as market_id,
            count() as cnt
          FROM events
          WHERE event = 'booking_initiated'
            AND timestamp >= '${thirtyDaysAgo}'
          GROUP BY market_id
        `,
      }),
    ])

    // Map pageview results (path → market id)
    for (const [path, count] of pv30d) {
      const id = marketIds.find((mid: string) => path === `/fleamarkets/${mid}`)
      if (id && statsMap.has(id)) statsMap.get(id)!.pageviews_30d = count
    }
    for (const [path, count] of pvTotal) {
      const id = marketIds.find((mid: string) => path === `/fleamarkets/${mid}`)
      if (id && statsMap.has(id)) statsMap.get(id)!.pageviews_total = count
    }
    // Map booking_initiated results (market_id directly)
    for (const [marketId, count] of bi30d) {
      if (statsMap.has(marketId)) statsMap.get(marketId)!.bookings_initiated_30d = count
    }
  }

  const result = markets.map((market: { id: string; name: string }) => {
    const stats = statsMap.get(market.id)!
    return {
      flea_market_id: market.id,
      name: market.name,
      ...stats,
    }
  })

  return { markets: result }
})

/**
 * Execute a HogQL query and return rows as [key, count] pairs.
 * The query must SELECT two columns: a grouping key and a count.
 */
async function batchHogQL(
  host: string,
  apiKey: string,
  projectId: string,
  params: { query: string },
): Promise<Array<[string, number]>> {
  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: { kind: 'HogQLQuery', query: params.query },
      }),
    })

    if (!res.ok) return []

    const data = await res.json()
    // HogQL returns { results: [[key, count], ...] }
    return (data.results ?? []).map((row: unknown[]) => [
      String(row[0] ?? ''),
      Number(row[1] ?? 0),
    ])
  } catch {
    return []
  }
}
