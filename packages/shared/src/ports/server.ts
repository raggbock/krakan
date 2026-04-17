/** Lightweight queries for server-side SEO metadata and sitemap generation. */
export interface ServerDataPort {
  getMarketMeta(id: string): Promise<{
    name: string
    description: string | null
    city: string
    street: string
    zip_code: string
    latitude: number | null
    longitude: number | null
    is_permanent: boolean
    organizer_subscription_tier: number
    opening_hour_rules: Array<{
      type: string
      day_of_week: number
      anchor_date: string | null
      open_time: string
      close_time: string
    }>
    price_range: {
      min_sek: number
      max_sek: number
    } | null
    image_url: string | null
  } | null>

  getRouteMeta(id: string): Promise<{
    name: string
    description: string | null
    stopCount: number
  } | null>

  getOrganizerMeta(id: string): Promise<{
    name: string
    bio: string | null
    website: string | null
    marketCount: number
  } | null>

  listPublishedMarketIds(): Promise<Array<{ id: string; updatedAt: string }>>
  listPublishedRouteIds(): Promise<Array<{ id: string; updatedAt: string }>>
}
