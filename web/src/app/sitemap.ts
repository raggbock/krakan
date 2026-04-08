import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const baseUrl = 'https://fyndstigen.se'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/rundor`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ]

  // Flea markets
  const { data: markets } = await supabase
    .from('flea_markets')
    .select('id, updated_at')
    .not('published_at', 'is', null)
    .eq('is_deleted', false)

  const marketPages: MetadataRoute.Sitemap = (markets ?? []).map((m) => ({
    url: `${baseUrl}/fleamarkets/${m.id}`,
    lastModified: new Date(m.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  // Published routes
  const { data: routes } = await supabase
    .from('routes')
    .select('id, updated_at')
    .eq('is_published', true)
    .eq('is_deleted', false)

  const routePages: MetadataRoute.Sitemap = (routes ?? []).map((r) => ({
    url: `${baseUrl}/rundor/${r.id}`,
    lastModified: new Date(r.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...marketPages, ...routePages]
}
