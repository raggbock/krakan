/** Lightweight queries for server-side SEO metadata and sitemap generation. */
export interface ServerDataPort {
  /**
   * Resolves a market slug to its UUID. Returns null if no published market
   * exists with that slug. Used by /loppis/[slug] to map slug → id before
   * rendering, and by /fleamarkets/[id] to find the slug for redirecting.
   */
  getMarketIdBySlug(slug: string): Promise<string | null>
  /** Inverse: id → slug for redirecting old UUID URLs to new slug URLs. */
  getMarketSlugById(id: string): Promise<string | null>

  getMarketMeta(id: string): Promise<{
    name: string
    description: string | null
    city: string
    street: string
    zip_code: string
    latitude: number | null
    longitude: number | null
    is_permanent: boolean
    /** Null when market is still a draft. Used to gate metadata robots:noindex. */
    published_at: string | null
    organizer_subscription_tier: number
    opening_hour_rules: Array<{
      type: string
      day_of_week: number | null
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
    stops: Array<{
      position: number
      marketId: string
      marketSlug: string | null
      marketName: string
      city: string
      latitude: number | null
      longitude: number | null
    }>
  } | null>

  getOrganizerMeta(id: string): Promise<{
    name: string
    bio: string | null
    website: string | null
    marketCount: number
  } | null>

  listPublishedMarketIds(): Promise<Array<{ id: string; slug: string | null; updatedAt: string }>>
  listPublishedRouteIds(): Promise<Array<{ id: string; updatedAt: string }>>

  listCitiesWithMarkets(): Promise<Array<{ city: string; marketCount: number; latestUpdate: string }>>
  listMarketsInCity(cityNames: string[]): Promise<Array<{
    id: string
    slug: string | null
    name: string
    description: string | null
    street: string
    is_permanent: boolean
    city: string
    image_url: string | null
  }>>
}
