import { describe, it, expect, vi } from 'vitest'
import type { FleaMarketDetailsView } from '@fyndstigen/shared'
import type { LoppisData, LoppisSource } from './market-cache'

vi.mock('./market-cache', () => ({}))
vi.mock('@/components/track-market-view', () => ({ TrackMarketView: () => null }))
vi.mock('@/components/market/detail', () => ({ MarketDetail: () => null }))

import { buildLoppisMetadata, LoppisLayoutView } from './loppis-view'

function makeMarket(overrides: Partial<FleaMarketDetailsView> = {}): FleaMarketDetailsView {
  return {
    id: 'm1',
    name: 'Testloppis',
    description: 'Beskrivning',
    city: 'Tranås',
    street: 'Storgatan 1',
    zipCode: '573 30',
    country: 'SE',
    isPermanent: true,
    organizerId: 'o1',
    organizerName: 'Arr',
    organizerSubscriptionTier: 0,
    publishedAt: '2024-01-01T00:00:00Z',
    latitude: 0,
    longitude: 0,
    autoAcceptBookings: false,
    createdAt: '2024-01-01T00:00:00Z',
    slug: 'testloppis',
    openingHourRules: [],
    openingHourExceptions: [],
    images: [],
    ...overrides,
  } as FleaMarketDetailsView
}

function sourceFor(market: FleaMarketDetailsView): LoppisSource {
  const data: LoppisData = {
    id: market.id,
    market,
    tables: [],
    meta: { organizer_subscription_tier: 0, price_range: null, image_url: null },
  }
  return { resolve: async () => data, client: async () => ({}) as never }
}

describe('buildLoppisMetadata robots', () => {
  it('is noindex for closed markets', async () => {
    const md = await buildLoppisMetadata('testloppis', sourceFor(makeMarket({ status: 'closed' })))
    expect(md.robots).toEqual({ index: false, follow: false })
  })

  it('is noindex for drafts', async () => {
    const md = await buildLoppisMetadata('testloppis', sourceFor(makeMarket({ publishedAt: null })))
    expect(md.robots).toEqual({ index: false, follow: false })
  })

  it('has no robots override for confirmed markets', async () => {
    const md = await buildLoppisMetadata('testloppis', sourceFor(makeMarket({ status: 'confirmed' })))
    expect(md.robots).toBeUndefined()
  })
})

describe('LoppisLayoutView JSON-LD', () => {
  function hasJsonLd(node: unknown): boolean {
    if (Array.isArray(node)) return node.some(hasJsonLd)
    if (!node || typeof node !== 'object') return false
    const el = node as { type?: unknown; props?: { type?: string; children?: unknown } }
    if (el.type === 'script' && el.props?.type === 'application/ld+json') return true
    return hasJsonLd(el.props?.children)
  }

  it('emits no structured data for closed markets', async () => {
    const out = await LoppisLayoutView({ slug: 'testloppis', source: sourceFor(makeMarket({ status: 'closed' })), children: null })
    expect(hasJsonLd(out)).toBe(false)
  })

  it('emits structured data for confirmed markets', async () => {
    const out = await LoppisLayoutView({ slug: 'testloppis', source: sourceFor(makeMarket({ status: 'confirmed' })), children: null })
    expect(hasJsonLd(out)).toBe(true)
  })
})
