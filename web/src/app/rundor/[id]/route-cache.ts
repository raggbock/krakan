/**
 * Request-scoped cache helper for /rundor/[id].
 *
 * Both layout.tsx and page.tsx import `resolveRoute` from here so they share
 * the same React cache() instance — one DB round-trip per id per request,
 * regardless of how many Server Components call this function.
 *
 * Round-trips per render:
 *   1. routes.get(id)  — one Supabase call, returns full RouteView with stops
 *   Total: 1 network RTT / 1 Supabase call (down from 2 RTTs / 2 calls)
 *
 * The layout previously called getRouteMeta(id) and page.tsx triggered a
 * second call via useRoute(id) on the client. Both are now replaced by this
 * single server-side fetch.
 */
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseRoutes } from '@fyndstigen/shared'
import type { RouteView } from '@fyndstigen/shared'

/**
 * Resolves id → full RouteView (including stops with flea market details).
 * Returns null when the route does not exist or when running without a real
 * Supabase URL (CI / build envs).
 * React cache() dedupes calls within a single request.
 */
export const resolveRoute = cache(async (id: string): Promise<RouteView | null> => {
  // CI / build environments without a real Supabase URL would otherwise
  // hang ~30 s on each /rundor/[id] render waiting for the fetch to fail.
  // Bail fast so page.tsx 404s and the build proceeds.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || url.includes('placeholder.supabase.co')) return null

  const supabase = await createSupabaseServerClient()
  const routes = createSupabaseRoutes(supabase)

  try {
    return await routes.get(id)
  } catch {
    // routes.get throws when the row is not found (Supabase .single() error).
    return null
  }
})
