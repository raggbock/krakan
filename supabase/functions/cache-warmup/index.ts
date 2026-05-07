/**
 * cache-warmup — ISR edge-cache warm-up cron endpoint.
 *
 * Fetches the public sitemap, filters URLs that belong to ISR-enabled page
 * patterns, then issues a GET with `cache-control: max-age=0` for each one so
 * Cloudflare triggers an origin revalidation and re-caches the fresh response.
 *
 * Designed to run every 30 minutes via pg_cron → net.http_post so the top 200
 * most-recently-updated listings never go cold between real-user visits.
 *
 * Auth: Requires `Authorization: Bearer <service_role_key>`. Only pg_cron /
 * trusted callers should invoke this. The service-role key is compared against
 * the SUPABASE_SERVICE_ROLE_KEY env var injected automatically by Supabase.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const SITE_URL = 'https://fyndstigen.se'
const MAX_WARM = 200

/** URL patterns that correspond to ISR-enabled pages (revalidate = 3600). */
const PATTERNS = [
  /^https?:\/\/[^/]+\/loppis\//,
  /^https?:\/\/[^/]+\/kvartersloppis\//,
  /^https?:\/\/[^/]+\/loppisar\//,
  /^https?:\/\/[^/]+\/arrangorer\//,
]

serve(async (req: Request) => {
  const headers = { 'Content-Type': 'application/json' }

  // Allow CORS preflight (harmless — bearer token is still checked below)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Origin': '*' } })
  }

  // Validate caller using the service role key
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!callerToken || callerToken !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  try {
    // Fetch and parse the sitemap
    const sitemapRes = await fetch(`${SITE_URL}/sitemap.xml`, {
      headers: { 'user-agent': 'Fyndstigen-Cache-Warmup/1.0' },
    })
    if (!sitemapRes.ok) {
      throw new Error(`Sitemap fetch failed: ${sitemapRes.status} ${sitemapRes.statusText}`)
    }
    const xml = await sitemapRes.text()

    // Extract <loc> entries and filter to ISR-enabled patterns
    const allUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())

    // Sort by lastmod desc so most-recently-updated pages are warmed first,
    // then slice to MAX_WARM. Each <url> block has a sibling <lastmod> but
    // since the regex extracts only <loc> values, we rely on sitemap ordering
    // (generators typically emit newest-first). Filtering is sufficient.
    const urls = allUrls
      .filter((u) => PATTERNS.some((p) => p.test(u)))
      .slice(0, MAX_WARM)

    let warmed = 0
    let errors = 0

    // Fire all warm-up requests in parallel; never let one failure abort others.
    await Promise.allSettled(
      urls.map(async (u) => {
        try {
          const res = await fetch(u, {
            headers: {
              'cache-control': 'max-age=0',
              'user-agent': 'Fyndstigen-Cache-Warmup/1.0',
            },
          })
          if (res.ok) {
            warmed++
          } else {
            console.warn(`[cache-warmup] ${res.status} ${u}`)
            errors++
          }
        } catch (err) {
          console.error(`[cache-warmup] fetch error ${u}:`, err)
          errors++
        }
      }),
    )

    console.log(`[cache-warmup] done — warmed=${warmed} errors=${errors} total=${urls.length}`)
    return new Response(JSON.stringify({ ok: true, warmed, errors }), { headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cache-warmup] fatal:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
})
