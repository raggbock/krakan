import type { SupabaseClient } from '@supabase/supabase-js'
import { createEndpointInvokers } from './endpoints'

/**
 * Supabase wraps every non-2xx edge-function response in a `FunctionsHttpError`
 * whose `.message` is always the generic string
 * "Edge Function returned a non-2xx status code". The structured
 * `{ error: '<code>' }` body that our edge functions emit via
 * `definePublicEndpoint` / `createHandler` lives on `err.context` (a `Response`
 * object) but is never surfaced by the SDK. This helper unwraps it so that
 * callers' code-to-label maps (e.g. `ERROR_LABEL` in
 * `takeover/[token]/page.tsx`) receive the real error code as `err.message`
 * instead of the unhelpful generic string.
 */
async function unwrapEdgeError(rawErr: unknown): Promise<never> {
  const ctx = (rawErr as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    let body: unknown = null
    try { body = await ctx.clone().json() } catch { /* not JSON — fall through */ }
    if (
      body && typeof body === 'object' && 'error' in body
      && typeof (body as { error: unknown }).error === 'string'
    ) {
      throw Object.assign(new Error((body as { error: string }).error), { cause: rawErr })
    }
  }
  throw rawErr
}

/**
 * Thin wrapper around supabase.functions.invoke that:
 *   - fetches the current session and attaches a Bearer token
 *   - throws a plain Error('Not authenticated') when no access token exists
 *   - normalizes the `{ data, error }` shape into a resolved/rejected promise
 *
 * Error translation to Swedish-user-facing messages is intentionally out of
 * scope here; that lives in the caller (and will move to AppError in RFC #17).
 */
export type EdgeClient = {
  invoke<TOut>(name: string, body?: unknown): Promise<TOut>
  /** Same as invoke, but does NOT require an auth session — for endpoints
   * deployed with verify_jwt:false (e.g. public token-gated takeover flow).
   * The supabase client still applies the anon key as apikey. */
  invokePublic<TOut>(name: string, body?: unknown): Promise<TOut>
}

export function createEdgeClient(supabase: SupabaseClient): EdgeClient {
  return {
    async invoke<TOut>(name: string, body?: unknown): Promise<TOut> {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        // eslint-disable-next-line no-restricted-syntax -- programming guard: adapter-level auth check before the request is sent; callers should ensure auth state upstream
        throw new Error('Not authenticated')
      }

      const options: Record<string, unknown> = {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
      if (body !== undefined) options.body = body

      const res = await supabase.functions.invoke(name, options as Parameters<typeof supabase.functions.invoke>[1])
      if (res.error) await unwrapEdgeError(res.error)
      return res.data as TOut
    },

    async invokePublic<TOut>(name: string, body?: unknown): Promise<TOut> {
      const options: Record<string, unknown> = {}
      if (body !== undefined) options.body = body
      const res = await supabase.functions.invoke(name, options as Parameters<typeof supabase.functions.invoke>[1])
      if (res.error) await unwrapEdgeError(res.error)
      return res.data as TOut
    },
  }
}

export function createEdgeApi(supabase: SupabaseClient) {
  const edge = createEdgeClient(supabase)
  return {
    edge,
    /**
     * Typed invokers for the flat ENDPOINTS registry (RFC #39 / #43).
     *
     * Usage:
     *   api.endpoints['stripe.payment.capture'].invoke({ bookingId })
     *   api.endpoints['booking.create'].invoke({ ... })
     */
    endpoints: createEndpointInvokers(edge),
  }
}
