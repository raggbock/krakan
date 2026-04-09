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
  } | null>

  getRouteMeta(id: string): Promise<{
    name: string
    description: string | null
    stopCount: number
  } | null>

  listPublishedMarketIds(): Promise<Array<{ id: string; updatedAt: string }>>
  listPublishedRouteIds(): Promise<Array<{ id: string; updatedAt: string }>>
}
