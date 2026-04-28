/**
 * Shared token-validation helper for the five takeover edge functions.
 *
 * All five handlers shared an identical 5–7 line block that:
 *   1. Hashed the raw token
 *   2. Queried business_owner_tokens
 *   3. Threw 404 if missing, 410 if used/invalidated/expired
 *
 * This module extracts that block into a single tested function so there
 * is one canonical implementation and one place to fix bugs.
 *
 * ---------------------------------------------------------------------------
 * Error-semantics audit (handlers as of 2025-04-28):
 *
 *   Handler             token_not_found  used      invalidated  expired
 *   ----------------    ---------------  --------  -----------  -------
 *   takeover-info       404              410        410          410
 *   takeover-start      404              410        410          410
 *   takeover-verify     404              410        410          410
 *   takeover-feedback   404              410        410          410
 *   takeover-remove     404              410        410          410
 *
 * All five were identical — no divergence. The canonical behavior below
 * matches exactly.
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sha256Hex } from '@fyndstigen/shared/crypto.ts'
import { HttpError } from './handler.ts'

/**
 * Full shape of a `business_owner_tokens` row as selected by
 * `validateTakeoverToken`. All nullable DB columns are typed as
 * `string | null` to match the actual schema.
 *
 * `clicked_at` is included here so `takeover-info` can inspect it after
 * validation without an additional round-trip. The other handlers simply
 * ignore the field.
 */
export type TakeoverTokenRow = {
  id: string
  flea_market_id: string
  sent_to_email: string | null
  expires_at: string
  used_at: string | null
  invalidated_at: string | null
  clicked_at: string | null
}

export type ValidateOpts = {
  /**
   * When true, stamp `clicked_at = now()` if the column is currently null.
   * Best-effort — a DB failure here is logged but never rethrown, so the
   * page still renders.
   *
   * Used by `takeover-info` (first-click funnel metric). All other handlers
   * leave this false (default).
   */
  stampClickedAt?: boolean
}

/**
 * Validate a raw takeover token, returning the full DB row on success.
 *
 * Throws:
 *   - `HttpError(404, 'token_not_found')` — no row matches the hash
 *   - `HttpError(410, 'token_already_used')` — `used_at` is set
 *   - `HttpError(410, 'token_invalidated')` — `invalidated_at` is set
 *   - `HttpError(410, 'token_expired')` — past `expires_at`
 *   - plain `Error` — unexpected Supabase error (becomes HTTP 400 via
 *     the `definePublicEndpoint` catch block)
 *
 * @param admin  Service-role Supabase client (from `getSupabaseAdmin()`).
 * @param token  Raw token string from the request body.
 * @param opts   Optional flags, see `ValidateOpts`.
 */
export async function validateTakeoverToken(
  admin: SupabaseClient,
  token: string,
  opts: ValidateOpts = {},
): Promise<TakeoverTokenRow> {
  const tokenHash = await sha256Hex(token)

  const { data: tokenRow, error } = await admin
    .from('business_owner_tokens')
    .select('id, flea_market_id, sent_to_email, expires_at, used_at, invalidated_at, clicked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!tokenRow) throw new HttpError(404, 'token_not_found')
  if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
  if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
  if (Date.parse(tokenRow.expires_at as string) < Date.now()) throw new HttpError(410, 'token_expired')

  // Optional: stamp first-click timestamp for funnel metrics.
  if (opts.stampClickedAt && !tokenRow.clicked_at) {
    const { error: clickErr } = await admin
      .from('business_owner_tokens')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
    if (clickErr) console.error('[takeover-token] click stamp failed:', clickErr.message)
  }

  return tokenRow as TakeoverTokenRow
}
