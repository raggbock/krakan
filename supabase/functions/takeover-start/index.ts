import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { validateTakeoverToken } from '../_shared/takeover-token.ts'
import { claimTakeover } from '../_shared/claim-takeover.ts'
import {
  TakeoverStartInput,
  TakeoverStartOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

/**
 * Single-shot claim flow:
 *   - Validate token + email-match (must match sent_to_email exactly).
 *   - Resolve or create the auth user.
 *   - Spend the token + transfer ownership in claim_takeover_atomic.
 *   - Mail a magic-link redirecting to the now-claimed market's slug page.
 *
 * The shared tail (user resolve → claim → magic-link → email) lives in
 * ClaimTakeoverService (_shared/claim-takeover.ts). Only the start-specific
 * pre-checks (email-match, is_deleted guard, slug extraction) remain here.
 */
definePublicEndpoint({
  name: 'takeover-start',
  input: TakeoverStartInput,
  output: TakeoverStartOutput,
  handler: async ({ admin, origin }, input) => {
    const submittedEmail = input.email.toLowerCase()
    const tokenRow = await validateTakeoverToken(admin, input.token)

    // Helper: stamp every attempt outcome on the token row so we have
    // consent-independent telemetry on where in the flow visitors fail.
    // Atomic increment via RPC so we don't need to round-trip the current
    // count. Best-effort — failure to stamp must never block the response.
    async function stampAttempt(failureCode: string | null) {
      const { error } = await admin.rpc('stamp_takeover_attempt', {
        p_token_id: tokenRow.id,
        p_failure_code: failureCode,
      })
      if (error) console.error('[takeover-start] attempt stamp failed:', error.message)
    }

    try {
      // Start-specific: the submitted email must match the invite recipient.
      const expectedEmail = tokenRow.sent_to_email?.trim().toLowerCase()
      if (!expectedEmail) throw new HttpError(400, 'token_has_no_recipient')
      if (submittedEmail !== expectedEmail) throw new HttpError(400, 'email_mismatch')

      // Bail out before user creation if the underlying market is gone —
      // saves an orphan auth row that would otherwise sit unused.
      const { data: market, error: mErr } = await admin
        .from('flea_markets')
        .select('name, slug, is_deleted')
        .eq('id', tokenRow.flea_market_id)
        .single()
      if (mErr) throw new Error(mErr.message)
      if (market.is_deleted) throw new HttpError(410, 'market_removed')

      // Magic-link redirects straight to the claimed market's slug page —
      // visitors immediately see their newly-owned listing with the draft
      // banner (or a fresh edit link if already published).
      const slug = market.slug as string | null
      const redirectTo = slug ? `${origin}/loppis/${slug}?from=takeover` : `${origin}/profile`

      const { magicLinkSent } = await claimTakeover({
        admin,
        tokenRow,
        rawToken: input.token,
        email: submittedEmail,
        origin,
        magicLinkRedirectTo: redirectTo,
      })

      await stampAttempt(null)
      return { ok: true as const, magicLinkSent }
    } catch (err) {
      const code = err instanceof HttpError ? err.message : 'unexpected_error'
      await stampAttempt(code)
      throw err
    }
  },
})
