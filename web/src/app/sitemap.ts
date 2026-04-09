import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'

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
  ]

  const markets = await server.listPublishedMarketIds()
  const marketPages: MetadataRoute.Sitemap = markets.map((m) => ({
    url: `${baseUrl}/fleamarkets/${m.id}`,
    lastModified: new Date(m.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  const routes = await server.listPublishedRouteIds()
  const routePages: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${baseUrl}/rundor/${r.id}`,
    lastModified: new Date(r.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...marketPages, ...routePages]
}
