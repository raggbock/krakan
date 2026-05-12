/**
 * digest-builder — pure function that turns a user's pending notification
 * deliveries into a ready-to-send email digest (subject, HTML, plaintext).
 *
 * All Swedish copy lives here. No I/O — fully unit-testable.
 */

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type NotificationDeliveryRow = {
  id: string
  userId: string
  eventId: string
  reason: 'market' | 'city'
  channel: 'inbox' | 'email'
  status: string
  createdAt: string

  // Joined from notification_events
  eventType: 'market.published' | 'market.updated' | 'market.new_date' | 'block_sale.published'
  eventPayload: Record<string, unknown>
  occurredAt: string

  // Joined display data — nullable when the event has no market (e.g. block_sale.published)
  fleaMarketId: string | null
  citySlug: string | null
}

export type DigestInput = {
  userId: string
  recipientEmail: string
  deliveries: NotificationDeliveryRow[]  // caller passes sorted by occurredAt desc
  unsubscribeToken: string
  baseUrl: string  // e.g. 'https://fyndstigen.se'
}

export type Digest = {
  emailSubject: string
  emailHtml: string
  emailPlaintext: string
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

type MarketGroup = {
  marketId: string
  marketName: string
  slug: string
  citySlug: string | null
  events: NotificationDeliveryRow[]
}

type CityGroup = {
  citySlug: string
  events: NotificationDeliveryRow[]
}

function groupDeliveries(deliveries: NotificationDeliveryRow[]): {
  markets: MarketGroup[]
  cities: CityGroup[]
} {
  const marketMap = new Map<string, MarketGroup>()
  const cityMap = new Map<string, CityGroup>()

  for (const d of deliveries) {
    if (d.fleaMarketId) {
      // Market-specific event — group under the market
      const payload = d.eventPayload
      const marketName = String(payload.market_name ?? 'Okänd loppis')
      const slug = String(payload.slug ?? d.fleaMarketId)
      const existing = marketMap.get(d.fleaMarketId)
      if (existing) {
        existing.events.push(d)
      } else {
        marketMap.set(d.fleaMarketId, {
          marketId: d.fleaMarketId,
          marketName,
          slug,
          citySlug: d.citySlug,
          events: [d],
        })
      }
    } else if (d.citySlug) {
      // City-level event (e.g. block_sale.published with no flea_market_id)
      const existing = cityMap.get(d.citySlug)
      if (existing) {
        existing.events.push(d)
      } else {
        cityMap.set(d.citySlug, {
          citySlug: d.citySlug,
          events: [d],
        })
      }
    }
  }

  return {
    markets: Array.from(marketMap.values()),
    cities: Array.from(cityMap.values()),
  }
}

// ---------------------------------------------------------------------------
// Swedish copy helpers
// ---------------------------------------------------------------------------

function eventTypeLabel(
  eventType: NotificationDeliveryRow['eventType'],
  payload: Record<string, unknown>,
): string {
  switch (eventType) {
    case 'market.published':
      return 'Loppisen har publicerats'
    case 'market.updated':
      return 'Loppisen har uppdaterats (namn eller beskrivning ändrades)'
    case 'market.new_date': {
      const date = payload.anchor_date ? String(payload.anchor_date) : null
      const open = payload.open_time ? String(payload.open_time) : null
      const close = payload.close_time ? String(payload.close_time) : null
      const timeRange =
        open && close ? ` kl ${open}–${close}` : ''
      return date
        ? `Nytt datum tillagt: ${formatSwedishDate(date)}${timeRange}`
        : 'Nytt öppningsdatum tillagt'
    }
    case 'block_sale.published': {
      const name = payload.block_sale_name ? String(payload.block_sale_name) : 'Kvartersloppis'
      const start = payload.start_date ? String(payload.start_date) : null
      const end = payload.end_date ? String(payload.end_date) : null
      const dateRange =
        start && end
          ? ` (${formatSwedishDate(start)}–${formatSwedishDate(end)})`
          : start
            ? ` (${formatSwedishDate(start)})`
            : ''
      return `${name} har publicerats${dateRange}`
    }
  }
}

function formatSwedishDate(isoDate: string): string {
  // Handle both 'YYYY-MM-DD' and full ISO timestamps
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Stockholm',
  })
}

function subjectLine(totalEvents: number): string {
  if (totalEvents === 1) return 'Fyndstigen: 1 ny händelse'
  if (totalEvents <= 5) return `Fyndstigen: ${totalEvents} nya händelser`
  return `Fyndstigen: ${totalEvents} nya händelser hos dina följda loppisar`
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildHtml(
  markets: MarketGroup[],
  cities: CityGroup[],
  baseUrl: string,
  unsubscribeUrl: string,
): string {
  const sections: string[] = []

  for (const market of markets) {
    const marketUrl = `${baseUrl}/loppis/${market.slug}`
    const eventItems = market.events
      .map(
        (e) =>
          `<li style="margin-bottom:6px;color:#3d2a1a;">${eventTypeLabel(e.eventType, e.eventPayload)}</li>`,
      )
      .join('\n')

    sections.push(`
      <div style="margin-bottom:24px;padding:16px;background:#fdf8f3;border-radius:8px;border:1px solid #e8ddd2;">
        <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#3d2a1a;">
          <a href="${marketUrl}" style="color:#b5451b;text-decoration:none;">${market.marketName}</a>
        </h2>
        <ul style="margin:0;padding-left:20px;">
          ${eventItems}
        </ul>
        <a href="${marketUrl}" style="display:inline-block;margin-top:10px;font-size:13px;color:#b5451b;">
          Visa loppisen &rarr;
        </a>
      </div>
    `)
  }

  for (const city of cities) {
    const cityUrl = `${baseUrl}/loppisar/${city.citySlug}`
    const eventItems = city.events
      .map(
        (e) =>
          `<li style="margin-bottom:6px;color:#3d2a1a;">${eventTypeLabel(e.eventType, e.eventPayload)}</li>`,
      )
      .join('\n')

    sections.push(`
      <div style="margin-bottom:24px;padding:16px;background:#fdf8f3;border-radius:8px;border:1px solid #e8ddd2;">
        <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#3d2a1a;">
          <a href="${cityUrl}" style="color:#b5451b;text-decoration:none;">Stad: ${city.citySlug}</a>
        </h2>
        <ul style="margin:0;padding-left:20px;">
          ${eventItems}
        </ul>
        <a href="${cityUrl}" style="display:inline-block;margin-top:10px;font-size:13px;color:#b5451b;">
          Visa stad &rarr;
        </a>
      </div>
    `)
  }

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Fyndstigen – dagens sammanfattning</title>
</head>
<body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f7f0e8;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${baseUrl}" style="text-decoration:none;">
        <span style="font-size:22px;font-weight:900;color:#3d2a1a;letter-spacing:-0.5px;">Fyndstigen</span>
      </a>
      <p style="margin:6px 0 0;font-size:13px;color:#7a5c46;">Din dagliga loppissammanfattning</p>
    </div>

    <!-- Sections -->
    ${sections.join('\n')}

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #ddd;text-align:center;font-size:12px;color:#999;">
      <p>Du får detta e-postmeddelande eftersom du följer loppisar eller städer på Fyndstigen.</p>
      <p>
        <a href="${unsubscribeUrl}" style="color:#b5451b;">Avsluta prenumeration</a>
        &nbsp;&middot;&nbsp;
        <a href="${baseUrl}/profile/notifikationer" style="color:#b5451b;">Hantera inställningar</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Plaintext builder
// ---------------------------------------------------------------------------

function buildPlaintext(
  markets: MarketGroup[],
  cities: CityGroup[],
  baseUrl: string,
  unsubscribeUrl: string,
): string {
  const lines: string[] = [
    'FYNDSTIGEN – Din dagliga loppissammanfattning',
    '==============================================',
    '',
  ]

  for (const market of markets) {
    const marketUrl = `${baseUrl}/loppis/${market.slug}`
    lines.push(`## ${market.marketName}`)
    for (const e of market.events) {
      lines.push(`  • ${eventTypeLabel(e.eventType, e.eventPayload)}`)
    }
    lines.push(`  ${marketUrl}`)
    lines.push('')
  }

  for (const city of cities) {
    const cityUrl = `${baseUrl}/loppisar/${city.citySlug}`
    lines.push(`## Stad: ${city.citySlug}`)
    for (const e of city.events) {
      lines.push(`  • ${eventTypeLabel(e.eventType, e.eventPayload)}`)
    }
    lines.push(`  ${cityUrl}`)
    lines.push('')
  }

  lines.push('----------------------------------------------')
  lines.push('Du får detta e-postmeddelande eftersom du följer loppisar eller städer på Fyndstigen.')
  lines.push('')
  lines.push(`Avsluta prenumeration: ${unsubscribeUrl}`)
  lines.push(`Hantera inställningar: ${baseUrl}/profile/notifikationer`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a digest email from the user's pending deliveries.
 * Returns null when there are no deliveries — caller should skip sending.
 */
export function buildDigest(input: DigestInput): Digest | null {
  const { deliveries, unsubscribeToken, baseUrl } = input

  if (deliveries.length === 0) return null

  const { markets, cities } = groupDeliveries(deliveries)
  const totalEvents = deliveries.length
  const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`

  const emailSubject = subjectLine(totalEvents)
  const emailHtml = buildHtml(markets, cities, baseUrl, unsubscribeUrl)
  const emailPlaintext = buildPlaintext(markets, cities, baseUrl, unsubscribeUrl)

  return { emailSubject, emailHtml, emailPlaintext }
}
