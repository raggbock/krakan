import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData, slugifyCity } from '@fyndstigen/shared'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  const server = createSupabaseServerData(supabase)
  const baseUrl = 'https://fyndstigen.se'

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/rundor`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/skapa`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/fragor-svar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ]

  // Fetch all data sources in parallel — they are independent DB queries.
  const [markets, cities, routes, blockSales] = await Promise.all([
    server.listPublishedMarketIds(),
    server.listCitiesWithMarkets(),
    server.listPublishedRouteIds(),
    server.listPublishedBlockSaleIds(),
  ])

  // Prefer slug URLs — every published market has one (DB-enforced unique
  // index). The id-fallback is purely defensive in case a slugless row
  // sneaks through during a future migration; it 308-redirects to the
  // canonical slug URL anyway.
  const marketPages: MetadataRoute.Sitemap = markets.map((m) => ({
    url: m.slug
      ? `${baseUrl}/loppis/${m.slug}`
      : `${baseUrl}/fleamarkets/${m.id}`,
    lastModified: new Date(m.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  const citySlugs = new Set<string>()
  for (const c of cities) citySlugs.add(slugifyCity(c.city))
  const cityPages: MetadataRoute.Sitemap = cities
    // Dedupe by slug (multiple casings of the same city → one entry)
    .filter((c, i, arr) => arr.findIndex((x) => slugifyCity(x.city) === slugifyCity(c.city)) === i)
    .map((c) => ({
      url: `${baseUrl}/loppisar/${slugifyCity(c.city)}`,
      lastModified: new Date(c.latestUpdate),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const routePages: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${baseUrl}/rundor/${r.id}`,
    lastModified: new Date(r.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const blockSalePages: MetadataRoute.Sitemap = blockSales.map((bs) => ({
    url: `${baseUrl}/kvartersloppis/${bs.slug}`,
    lastModified: new Date(bs.updatedAt),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...cityPages, ...marketPages, ...routePages, ...blockSalePages]
}
