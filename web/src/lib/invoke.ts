import { supabase } from './supabase'

/**
 * Thin wrapper around `supabase.functions.invoke()` that unwraps the
 * structured error body that the edge-function handlers return. Without
 * this, hooks receive the generic 'Edge Function returned a non-2xx
 * status code' message instead of our `token_expired`-style codes.
 */
export async function invokeEdgeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context
    if (ctx?.json) {
      try {
        const parsed = (await ctx.json()) as { error?: string; code?: string }
        throw new Error(parsed.error ?? parsed.code ?? error.message)
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }
  return data as T
}
