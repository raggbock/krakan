import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('@fyndstigen/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fyndstigen/shared')>()
  return {
    ...actual,
    createSupabaseServerData: () => ({
      listPublishedMarketIds: async () => [],
      listCitiesWithMarkets: async () => [
        { city: 'Stockholm', marketCount: 65, latestUpdate: '2026-06-20', rawLabels: ['Stockholm', 'Södermalm'] },
        { city: 'Nacka', marketCount: 3, latestUpdate: '2026-06-20', rawLabels: ['Nacka'] },
      ],
      listPublishedRouteIds: async () => [],
      listPublishedBlockSaleIds: async () => [],
    }),
    createSupabaseImages: () => ({}),
  }
})

import sitemap from './sitemap'

describe('sitemap city pages', () => {
  beforeAll(() => {
    // Prevent early-bail in sitemap() which skips dynamic pages when no real DB URL is set
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('emits canonical city slugs and no district slug', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://fyndstigen.se/loppisar/stockholm')
    expect(urls).not.toContain('https://fyndstigen.se/loppisar/sodermalm')
  })
})
