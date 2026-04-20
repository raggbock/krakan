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
