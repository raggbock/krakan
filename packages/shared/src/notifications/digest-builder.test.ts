import { describe, it, expect } from 'vitest'
import { buildDigest } from './digest-builder'
import type { DigestInput, NotificationDeliveryRow } from './digest-builder'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_URL = 'https://fyndstigen.se'
const UNSUBSCRIBE_TOKEN = 'test-token-abc123'

function makeDelivery(
  overrides: Partial<NotificationDeliveryRow> = {},
): NotificationDeliveryRow {
  return {
    id: 'delivery-1',
    userId: 'user-1',
    eventId: 'event-1',
    reason: 'market',
    channel: 'email',
    status: 'pending',
    createdAt: '2026-05-12T06:00:00Z',
    eventType: 'market.updated',
    eventPayload: { market_name: 'Testloppisen', slug: 'testloppisen' },
    occurredAt: '2026-05-12T05:00:00Z',
    fleaMarketId: 'market-1',
    citySlug: 'stockholm',
    ...overrides,
  }
}

function makeInput(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    userId: 'user-1',
    recipientEmail: 'user@example.com',
    deliveries: [],
    unsubscribeToken: UNSUBSCRIBE_TOKEN,
    baseUrl: BASE_URL,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildDigest', () => {
  it('empty deliveries → returns null', () => {
    const result = buildDigest(makeInput({ deliveries: [] }))
    expect(result).toBeNull()
  })

  it('1 event, single market → correct subject and structure', () => {
    const delivery = makeDelivery({
      eventType: 'market.updated',
      eventPayload: { market_name: 'Gamla Stan Loppis', slug: 'gamla-stan-loppis' },
      fleaMarketId: 'market-1',
      citySlug: 'stockholm',
    })

    const result = buildDigest(makeInput({ deliveries: [delivery] }))

    expect(result).not.toBeNull()
    expect(result!.emailSubject).toBe('Fyndstigen: 1 ny händelse')

    // HTML should contain the market name and a link to the market page
    expect(result!.emailHtml).toContain('Gamla Stan Loppis')
    expect(result!.emailHtml).toContain(`${BASE_URL}/loppis/gamla-stan-loppis`)

    // Unsubscribe link present
    expect(result!.emailHtml).toContain(`/unsubscribe?token=${UNSUBSCRIBE_TOKEN}`)

    // Plaintext should contain the same information
    expect(result!.emailPlaintext).toContain('Gamla Stan Loppis')
    expect(result!.emailPlaintext).toContain(`${BASE_URL}/loppis/gamla-stan-loppis`)
    expect(result!.emailPlaintext).toContain(`/unsubscribe?token=${UNSUBSCRIBE_TOKEN}`)
  })

  it('5 events across 2 markets and 1 city → correct grouping', () => {
    const deliveries: NotificationDeliveryRow[] = [
      // Market A — 2 events
      makeDelivery({
        id: 'd-1', eventId: 'e-1',
        eventType: 'market.published',
        eventPayload: { market_name: 'Södermalm Loppis', slug: 'sodermalm-loppis' },
        fleaMarketId: 'market-a',
        citySlug: 'stockholm',
      }),
      makeDelivery({
        id: 'd-2', eventId: 'e-2',
        eventType: 'market.new_date',
        eventPayload: {
          market_name: 'Södermalm Loppis',
          slug: 'sodermalm-loppis',
          anchor_date: '2026-06-15',
          open_time: '09:00',
          close_time: '16:00',
        },
        fleaMarketId: 'market-a',
        citySlug: 'stockholm',
      }),
      // Market B — 2 events
      makeDelivery({
        id: 'd-3', eventId: 'e-3',
        eventType: 'market.updated',
        eventPayload: { market_name: 'Göteborg Marknaden', slug: 'goteborg-marknaden' },
        fleaMarketId: 'market-b',
        citySlug: 'goteborg',
      }),
      makeDelivery({
        id: 'd-4', eventId: 'e-4',
        eventType: 'market.new_date',
        eventPayload: {
          market_name: 'Göteborg Marknaden',
          slug: 'goteborg-marknaden',
          anchor_date: '2026-07-01',
          open_time: '10:00',
          close_time: '15:00',
        },
        fleaMarketId: 'market-b',
        citySlug: 'goteborg',
      }),
      // City event — 1 event (block sale, no market id)
      makeDelivery({
        id: 'd-5', eventId: 'e-5',
        eventType: 'block_sale.published',
        eventPayload: {
          block_sale_id: 'bs-1',
          block_sale_name: 'Vasastan Kvartersloppis',
          slug: 'vasastan-kvartersloppis',
          city: 'Stockholm',
          start_date: '2026-06-01',
          end_date: '2026-06-02',
        },
        fleaMarketId: null,
        citySlug: 'stockholm',
      }),
    ]

    const result = buildDigest(makeInput({ deliveries }))

    expect(result).not.toBeNull()
    expect(result!.emailSubject).toBe('Fyndstigen: 5 nya händelser')

    // Both markets should appear
    expect(result!.emailHtml).toContain('Södermalm Loppis')
    expect(result!.emailHtml).toContain('Göteborg Marknaden')

    // Market A: 2 events
    expect(result!.emailHtml).toContain('Loppisen har publicerats')
    expect(result!.emailHtml).toContain('Nytt datum tillagt')

    // Market B: updated + new date
    expect(result!.emailHtml).toContain('Göteborg Marknaden')

    // City group: block_sale.published
    expect(result!.emailHtml).toContain('Vasastan Kvartersloppis')
    expect(result!.emailHtml).toContain(`${BASE_URL}/loppisar/stockholm`)

    // Plaintext version
    expect(result!.emailPlaintext).toContain('## Södermalm Loppis')
    expect(result!.emailPlaintext).toContain('## Göteborg Marknaden')
    expect(result!.emailPlaintext).toContain('## Stad: stockholm')

    const plaintextLines = result!.emailPlaintext.split('\n')
    // First 5 lines for reporter sanity check:
    // Line 0: FYNDSTIGEN header
    // Line 1: separator
    // Line 2: empty
    // Line 3: ## <first market>
    // Line 4: bullet
    expect(plaintextLines[0]).toContain('FYNDSTIGEN')
    expect(plaintextLines[3]).toMatch(/^##\s/)
  })

  it('50 events — large digest does not crash and subject mentions count', () => {
    // 30 events across 5 markets, 20 city events
    const deliveries: NotificationDeliveryRow[] = []

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 6; j++) {
        deliveries.push(
          makeDelivery({
            id: `d-m-${i}-${j}`,
            eventId: `e-m-${i}-${j}`,
            eventType: 'market.updated',
            eventPayload: { market_name: `Loppis ${i + 1}`, slug: `loppis-${i + 1}` },
            fleaMarketId: `market-${i}`,
            citySlug: `city-${i}`,
          }),
        )
      }
    }

    for (let k = 0; k < 20; k++) {
      deliveries.push(
        makeDelivery({
          id: `d-c-${k}`,
          eventId: `e-c-${k}`,
          eventType: 'block_sale.published',
          eventPayload: {
            block_sale_name: `Kvartersloppis ${k + 1}`,
            slug: `kvartersloppis-${k + 1}`,
            city: 'Stockholm',
            start_date: '2026-06-10',
            end_date: '2026-06-11',
          },
          fleaMarketId: null,
          citySlug: 'stockholm',
        }),
      )
    }

    expect(deliveries).toHaveLength(50)

    const result = buildDigest(makeInput({ deliveries }))

    expect(result).not.toBeNull()
    expect(result!.emailSubject).toContain('50')
    expect(result!.emailHtml).toBeTruthy()
    expect(result!.emailPlaintext).toBeTruthy()
    // All 5 markets should appear
    for (let i = 0; i < 5; i++) {
      expect(result!.emailHtml).toContain(`Loppis ${i + 1}`)
    }
  })

  it('market.new_date event — Swedish date and time in label', () => {
    const delivery = makeDelivery({
      eventType: 'market.new_date',
      eventPayload: {
        market_name: 'Testloppis',
        slug: 'testloppis',
        anchor_date: '2026-09-20',
        open_time: '09:00',
        close_time: '15:00',
      },
      fleaMarketId: 'market-1',
      citySlug: null,
    })

    const result = buildDigest(makeInput({ deliveries: [delivery] }))

    expect(result).not.toBeNull()
    expect(result!.emailHtml).toContain('kl 09:00–15:00')
    expect(result!.emailHtml).toContain('2026')
  })

  it('block_sale.published event — date range in label', () => {
    const delivery = makeDelivery({
      eventType: 'block_sale.published',
      eventPayload: {
        block_sale_name: 'Majloppis',
        slug: 'majloppis',
        city: 'Malmö',
        start_date: '2026-05-01',
        end_date: '2026-05-02',
      },
      fleaMarketId: null,
      citySlug: 'malmo',
    })

    const result = buildDigest(makeInput({ deliveries: [delivery] }))

    expect(result).not.toBeNull()
    expect(result!.emailHtml).toContain('Majloppis')
    expect(result!.emailHtml).toContain(`${BASE_URL}/loppisar/malmo`)
  })
})
