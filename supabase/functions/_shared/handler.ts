import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getCorsHeaders, corsResponse } from './cors.ts'
import { getUser, getSupabaseAdmin } from './auth.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Known error types for proper HTTP status codes
export class HttpError extends Error {
  /**
   * Optional structured body. When set, the handler serialises this object
   * as the response body instead of wrapping `message` in `{ error: ... }`.
   * Used by `defineEndpoint` to return AppError-shaped payloads that the
   * client can parse without double-decoding.
   */
  body?: unknown

  constructor(public statusCode: number, message: string, body?: unknown) {
    super(message)
    this.body = body
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string, body?: unknown) { super(404, message, body) }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') { super(401, message) }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Not authorized') { super(403, message) }
}

export type RequestContext = {
  user: { id: string; email?: string }
  admin: SupabaseClient
  body: Record<string, unknown>
  origin: string
  req: Request
}

type HandlerFn = (ctx: RequestContext) => Promise<unknown>

/**
 * Creates a standardized edge function handler with:
 * - CORS preflight handling
 * - JWT auth verification
 * - JSON body parsing
 * - Error handling with proper HTTP status codes
 * - Consistent JSON response format
 */
export function createHandler(fn: HandlerFn) {
  serve(async (req: Request) => {
    const origin = req.headers.get('origin')
    const headers = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

    if (req.method === 'OPTIONS') return corsResponse(origin)

    try {
      const { user } = await getUser(req.headers.get('Authorization'))
      const admin = getSupabaseAdmin()

      let body: Record<string, unknown> = {}
      if (req.method === 'POST') {
        try { body = await req.json() } catch { /* empty body is ok */ }
      }

      const resolvedOrigin = origin || new URL(req.url).origin

      const result = await fn({ user, admin, body, origin: resolvedOrigin, req })

      return new Response(JSON.stringify(result), { headers })
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 400
      const body =
        error instanceof HttpError && error.body !== undefined
          ? error.body
          : { error: error instanceof Error ? error.message : 'Unknown error' }
      return new Response(JSON.stringify(body), { status: statusCode, headers })
    }
  })
}

/**
 * Verify that the current user is the organizer of a flea market.
 * Throws ForbiddenError if not.
 */
export async function verifyOrganizer(
  admin: SupabaseClient,
  fleaMarketId: string,
  userId: string,
): Promise<void> {
  const { data: market } = await admin
    .from('flea_markets')
    .select('organizer_id')
    .eq('id', fleaMarketId)
    .single()
  if (!market || market.organizer_id !== userId) throw new ForbiddenError()
}
