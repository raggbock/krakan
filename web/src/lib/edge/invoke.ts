/**
 * invokeEdgeFn — raw escape hatch for calling edge functions not yet in the
 * typed `endpoints` registry.
 *
 * Prefer `endpoints[key].invoke(body)` from `@/lib/edge/edge` for any function
 * that has a registered contract — that path gives static types, Zod validation,
 * and structured error unwrapping.
 *
 * Use this function only for functions not yet in the registry (RFC #39).
 * It unwraps the structured error body that the edge-function handlers return
 * so callers receive an `EdgeFnError` with `.code` / `.detail` instead of the
 * generic Supabase "non-2xx" message.
 *
 * The eslint-disable on the supabase.functions.invoke call is intentional —
 * see the inline comment for the rationale.
 */

import { supabase } from '../supabase'

/**
 * Thin wrapper around `supabase.functions.invoke()` that unwraps the
 * structured error body that the edge-function handlers return. Without
 * this, hooks receive the generic 'Edge Function returned a non-2xx
 * status code' message instead of our `token_expired`-style codes.
 */
/** Error type with `code` and `detail` populated from the edge function's
 * structured body (e.g. zod-validation `{ code: 'input.invalid', detail }`). */
export class EdgeFnError extends Error {
  code?: string
  detail?: unknown
  constructor(message: string, code?: string, detail?: unknown) {
    super(message)
    this.code = code
    this.detail = detail
  }
}

export async function invokeEdgeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line no-restricted-syntax -- this IS the typed wrapper for endpoints not (yet) in api.endpoints registry (RFC #39)
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context
    if (ctx?.json) {
      try {
        const parsed = (await ctx.json()) as { error?: string; code?: string; detail?: unknown }
        const msg = parsed.error ?? parsed.code ?? error.message
        throw new EdgeFnError(msg, parsed.code, parsed.detail)
      } catch (parseErr) {
        if (parseErr instanceof EdgeFnError) throw parseErr
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }
  return data as T
}
