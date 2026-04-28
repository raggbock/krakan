/**
 * ClaimTakeoverService — shared post-validation claim logic.
 *
 * Both `takeover-start` and `takeover-verify` share an identical tail after
 * token validation:
 *
 *   1. Resolve or create the auth user (email_confirm: true).
 *   2. Spend the token + transfer ownership via claim_takeover_atomic().
 *   3. Fetch the market name (best-effort, for the email subject).
 *   4. Generate a magic-link.
 *   5. If RESEND_API_KEY + actionLink are present, send the email.
 *   6. Return { magicLinkSent, marketName }.
 *
 * The caller decides `magicLinkRedirectTo`:
 *   - takeover-start  → /loppis/{slug}?from=takeover  (or /profile as fallback)
 *   - takeover-verify → /profile
 *
 * Error semantics (same codes as the original handlers, in order):
 *   - auth_user_email_view lookup failure      → plain Error (→ HTTP 500)
 *   - admin.auth.admin.createUser failure      → plain Error (→ HTTP 500)
 *   - claim_takeover_atomic: token_already_used → HttpError(410, 'token_already_used')
 *   - claim_takeover_atomic: market_deleted     → HttpError(410, 'market_removed')
 *   - claim_takeover_atomic: other              → plain Error (→ HTTP 500)
 *   - generateLink failure                     → plain Error (→ HTTP 500)
 *   - sendEmail failure                        → plain Error (→ HTTP 500)
 *
 * The market-name fetch is deliberately best-effort: a DB failure there is
 * logged but never rethrown, so ownership is never reversed by a cosmetic
 * lookup error.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HttpError } from './handler.ts'
import { sendEmail, DEFAULT_FROM } from './email.ts'
import { takeoverMagicLinkEmail } from './email-templates/takeover-code.ts'
import { sha256Hex } from './takeover-helpers.ts'
import type { TakeoverTokenRow } from './takeover-token.ts'

export type ClaimTakeoverInput = {
  admin: SupabaseClient
  /** Already-validated token row, returned by validateTakeoverToken(). */
  tokenRow: TakeoverTokenRow
  /** Raw token string — re-hashed here to pass to claim_takeover_atomic. */
  rawToken: string
  /** Normalised (lowercased) email to claim under. */
  email: string
  /** Request origin (e.g. https://fyndstigen.se) for absolute URLs. */
  origin: string
  /**
   * Where the magic-link should redirect after sign-in.
   *   - start:  `${origin}/loppis/${slug}?from=takeover`  (or /profile)
   *   - verify: `${origin}/profile`
   */
  magicLinkRedirectTo: string
}

export type ClaimTakeoverResult = {
  /** True when the magic-link email was successfully dispatched. */
  magicLinkSent: boolean
  /**
   * Market name fetched post-claim (best-effort). Null if the fetch failed
   * or the market has no name — callers may use 'din butik' as fallback.
   */
  marketName: string | null
}

export async function claimTakeover(input: ClaimTakeoverInput): Promise<ClaimTakeoverResult> {
  const { admin, tokenRow, rawToken, email, origin: _origin, magicLinkRedirectTo } = input

  // ------------------------------------------------------------------
  // 1. Resolve auth user — create if missing.
  //    email_confirm: true so the magic-link can sign them in directly.
  //    Ordering this BEFORE claim_takeover_atomic is intentional: a
  //    failure here leaves the token intact so admin can reissue without
  //    manual DB cleanup. (See history in takeover-verify comments.)
  // ------------------------------------------------------------------
  const { data: existing, error: lookupErr } = await admin
    .from('auth_user_email_view')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (lookupErr) throw new Error(lookupErr.message)

  let userId = existing?.id as string | undefined
  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createErr) throw new Error(createErr.message)
    userId = created.user.id
  }

  // ------------------------------------------------------------------
  // 2. Spend the token + transfer ownership atomically.
  //    validateTakeoverToken does not expose the hash, so we re-compute
  //    it here (cheap: one more SHA-256 call).
  // ------------------------------------------------------------------
  const tokenHash = await sha256Hex(rawToken)
  const { error: claimErr } = await admin.rpc('claim_takeover_atomic', {
    p_token_hash: tokenHash,
    p_user_id: userId,
  })
  if (claimErr) {
    if (claimErr.message?.includes('token_already_used')) {
      throw new HttpError(410, 'token_already_used')
    }
    if (claimErr.message?.includes('market_deleted')) {
      throw new HttpError(410, 'market_removed')
    }
    throw new Error(claimErr.message)
  }

  // ------------------------------------------------------------------
  // 3. Fetch market name — best-effort only. A failure here never
  //    reverses ownership; the user just gets 'din butik' in the email.
  // ------------------------------------------------------------------
  let marketName: string | null = null
  const { data: market, error: marketErr } = await admin
    .from('flea_markets')
    .select('name')
    .eq('id', tokenRow.flea_market_id)
    .single()
  if (marketErr) {
    console.error('[claim-takeover] market name fetch failed:', marketErr.message)
  } else {
    marketName = (market?.name as string) ?? null
  }

  // ------------------------------------------------------------------
  // 4. Generate magic-link.
  // ------------------------------------------------------------------
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: magicLinkRedirectTo },
  })
  if (linkErr) throw new Error(linkErr.message)

  // ------------------------------------------------------------------
  // 5. Send email — conditional on env key + actionLink being present.
  //    Both must be truthy; missing RESEND key silently skips the send
  //    (magicLinkSent = false) so ownership is never reversed.
  // ------------------------------------------------------------------
  let magicLinkSent = false
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const actionLink = linkData.properties?.action_link
  if (resendApiKey && actionLink) {
    const businessName = marketName ?? 'din butik'
    const { html, text } = takeoverMagicLinkEmail({ magicLink: actionLink, businessName })
    await sendEmail({
      to: email,
      subject: `Logga in på Fyndstigen — ${businessName}`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })
    magicLinkSent = true
  } else {
    // The token is already spent at this point — claim succeeded but the
    // magic-link email won't reach the user. Log loudly so prod can detect
    // missing/misconfigured RESEND_API_KEY before users start complaining
    // about silently-locked accounts. Soft-fail (vs throwing 500) is
    // intentional: throwing now would lie to the client about whether the
    // claim happened (it did) and make recovery harder.
    console.error(
      '[claim-takeover] post-claim email not sent — token already spent. ' +
      `email=${email} hasResendKey=${!!resendApiKey} hasActionLink=${!!actionLink}`,
    )
  }

  return { magicLinkSent, marketName }
}
