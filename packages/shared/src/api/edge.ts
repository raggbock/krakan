import type { SupabaseClient } from '@supabase/supabase-js'
import { createEndpointInvokers } from './endpoints'

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
      if (res.error) throw res.error
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
