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

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const result = await Promise.all(
    markets.map(async (market: { id: string; name: string }) => {
      let pageviews30d = 0
      let pageviewsTotal = 0
      let bookingsInitiated30d = 0

      if (posthogKey) {
        const urlPattern = `/fleamarkets/${market.id}`

        const [pv30, pvAll, bi30] = await Promise.all([
          queryPostHog(posthogHost, posthogKey, {
            event: '$pageview',
            properties: [{ key: '$current_url', value: urlPattern, operator: 'icontains' }],
            after: thirtyDaysAgo,
          }),
          queryPostHog(posthogHost, posthogKey, {
            event: '$pageview',
            properties: [{ key: '$current_url', value: urlPattern, operator: 'icontains' }],
          }),
          queryPostHog(posthogHost, posthogKey, {
            event: 'booking_initiated',
            properties: [{ key: 'flea_market_id', value: market.id, operator: 'exact' }],
            after: thirtyDaysAgo,
          }),
        ])

        pageviews30d = pv30
        pageviewsTotal = pvAll
        bookingsInitiated30d = bi30
      }

      return {
        flea_market_id: market.id,
        name: market.name,
        pageviews_30d: pageviews30d,
        pageviews_total: pageviewsTotal,
        bookings_initiated_30d: bookingsInitiated30d,
      }
    })
  )

  return { markets: result }
})

async function queryPostHog(
  host: string,
  apiKey: string,
  params: {
    event: string
    properties: { key: string; value: string; operator: string }[]
    after?: string
  },
): Promise<number> {
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')
  if (!projectId) return 0

  const body = {
    query: {
      kind: 'EventsQuery',
      event: params.event,
      properties: params.properties,
      ...(params.after ? { after: params.after } : {}),
      select: ['count()'],
    },
  }

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) return 0

    const data = await res.json()
    return data.results?.[0]?.[0] ?? 0
  } catch {
    return 0
  }
}
