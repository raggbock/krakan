const envOrigins = Deno.env.get('ALLOWED_ORIGINS')
if (!envOrigins) {
  console.warn('WARNING: ALLOWED_ORIGINS not set — CORS will reject all cross-origin requests')
}
const allowedOrigins = envOrigins ? envOrigins.split(',') : []

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const resolvedOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? ''
  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }
}

// Backwards-compatible export for functions that don't pass origin
export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0] ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function corsResponse(origin?: string | null) {
  return new Response('ok', { headers: origin ? getCorsHeaders(origin) : corsHeaders })
}

/**
 * Returns the request origin if it is on the allowlist, otherwise the
 * first allowed origin as a safe fallback. Use this when handing an
 * origin to something downstream (e.g. magic-link redirect URLs) where
 * an attacker-controlled Origin header must not leak through.
 */
export function getSafeOrigin(origin: string | null): string {
  if (origin && allowedOrigins.includes(origin)) return origin
  return allowedOrigins[0] ?? ''
}
