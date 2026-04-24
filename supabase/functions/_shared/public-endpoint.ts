import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { z } from 'zod'
import { getCorsHeaders, corsResponse, getSafeOrigin } from './cors.ts'
import { getSupabaseAdmin } from './auth.ts'
import { HttpError } from './handler.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Public-facing endpoint helper for routes that authenticate via their own
 * mechanism (token in body, webhook signature, etc.) rather than a JWT.
 *
 * Drop-in alternative to defineEndpoint for cases where verify_jwt is false.
 * Validates input, runs the handler with a service-role client + the raw
 * Request, and validates the output contract.
 */
export type PublicContext = {
  admin: SupabaseClient
  origin: string
  req: Request
}

export type PublicEndpointConfig<I, O> = {
  name: string
  input: z.ZodType<I>
  output: z.ZodType<O>
  handler: (ctx: PublicContext, input: I) => Promise<O>
}

export function definePublicEndpoint<I, O>(config: PublicEndpointConfig<I, O>): void {
  serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    const headers = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
    if (req.method === 'OPTIONS') return corsResponse(origin)

    try {
      let body: Record<string, unknown> = {}
      if (req.method === 'POST') {
        try { body = await req.json() } catch {}
      }
      const parsed = config.input.safeParse(body)
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ code: 'input.invalid', detail: { issues: parsed.error.issues } }),
          { status: 400, headers },
        )
      }
      const admin = getSupabaseAdmin()
      // Use the allowlist-vetted origin, never the raw Origin header.
      // A crafted request with Origin: https://attacker.com would
      // otherwise propagate into any handler that uses ctx.origin for
      // user-visible URLs (magic-link redirectTo, takeover URLs, etc.)
      const resolvedOrigin = getSafeOrigin(origin)
      const result = await config.handler({ admin, origin: resolvedOrigin, req }, parsed.data)
      return new Response(JSON.stringify(result), { headers })
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 400
      const body = error instanceof HttpError && error.body !== undefined
        ? error.body
        : { error: error instanceof Error ? error.message : 'Unknown error' }
      return new Response(JSON.stringify(body), { status: statusCode, headers })
    }
  })
}
