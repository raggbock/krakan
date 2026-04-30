/**
 * block-sale-archive — GDPR retention cron endpoint.
 *
 * Anonymizes applicant PII (email, name, edit_token) on block_sale_stands
 * whose parent block_sale ended more than 1 year ago. Called daily via
 * pg_cron → SQL function (see migration 00046).
 *
 * Auth: Requires the `Authorization: Bearer <service_role_key>` header so
 * only trusted callers (pg_cron via net.http_post or a scheduled CI job)
 * can trigger it. The service_role key is checked by comparing against the
 * SUPABASE_SERVICE_ROLE_KEY env var, which is injected automatically by
 * Supabase into every Edge Function runtime.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req: Request) => {
  const headers = { 'Content-Type': 'application/json' }

  // Allow CORS preflight (harmless — the bearer token is still checked below)
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
    const admin = getSupabaseAdmin()

    // Find block_sales that ended more than 1 year ago
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const { data: oldEvents, error: fetchError } = await admin
      .from('block_sales')
      .select('id')
      .lt('end_date', cutoff)

    if (fetchError) throw new Error(fetchError.message)

    const ids = (oldEvents ?? []).map((e: { id: string }) => e.id)
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, anonymized: 0 }), { headers })
    }

    // Anonymize PII on stands whose parent event ended over a year ago
    const { count, error: updateError } = await admin
      .from('block_sale_stands')
      .update({
        applicant_email: '',
        applicant_name: '',
        edit_token: '',
      }, { count: 'exact' })
      .in('block_sale_id', ids)
      .neq('applicant_email', '')

    if (updateError) throw new Error(updateError.message)

    return new Response(JSON.stringify({ ok: true, anonymized: count ?? 0 }), { headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
})
