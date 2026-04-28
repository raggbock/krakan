import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { validateTakeoverToken } from '../_shared/takeover-token.ts'
import { claimTakeover } from '../_shared/claim-takeover.ts'
import {
  MAX_CODE_ATTEMPTS,
  sha256Hex,
  timingSafeEqualHex,
} from '../_shared/takeover-helpers.ts'
import {
  TakeoverVerifyInput,
  TakeoverVerifyOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

/**
 * Legacy 6-digit-code verify step — kept deployed during the deprecation
 * window so anyone who received a code from the old flow can still finish
 * their claim.
 *
 * The verify-specific pre-checks (code validation, attempt throttle) remain
 * here. The shared tail (user resolve → claim → magic-link → email) is
 * delegated to ClaimTakeoverService (_shared/claim-takeover.ts).
 */
definePublicEndpoint({
  name: 'takeover-verify',
  input: TakeoverVerifyInput,
  output: TakeoverVerifyOutput,
  handler: async ({ admin, origin }, input) => {
    const email = input.email.toLowerCase()

    // Validate the core token (not found / used / invalidated / expired).
    const tokenRow = await validateTakeoverToken(admin, input.token)

    // Fetch the code-specific columns — not included in the common row shape.
    const { data: codeRow, error: codeErr } = await admin
      .from('business_owner_tokens')
      .select('verification_email, verification_code_hash, verification_code_expires_at')
      .eq('id', tokenRow.id)
      .single()
    if (codeErr) throw new Error(codeErr.message)

    if (!codeRow.verification_code_hash || !codeRow.verification_email) {
      throw new HttpError(400, 'no_code_sent')
    }
    if (codeRow.verification_email !== email) throw new HttpError(400, 'email_mismatch')
    if (Date.parse(codeRow.verification_code_expires_at as string) < Date.now()) {
      throw new HttpError(410, 'code_expired')
    }

    // Atomic bump-and-check via SQL function. Returns null if the row
    // was already at/above the cap — closes the TOCTOU window where two
    // concurrent requests could each pass a stale count check.
    const { data: newAttempts, error: bumpErr } = await admin.rpc('bump_takeover_attempt', {
      p_token_id: tokenRow.id,
      p_max_attempts: MAX_CODE_ATTEMPTS,
    })
    if (bumpErr) throw new Error(bumpErr.message)
    if (newAttempts == null) {
      await admin
        .from('business_owner_tokens')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', tokenRow.id)
      throw new HttpError(429, 'too_many_attempts')
    }

    const codeHash = await sha256Hex(input.code)
    const matches = timingSafeEqualHex(codeHash, codeRow.verification_code_hash as string)
    if (!matches) throw new HttpError(400, 'code_invalid')

    // --- Verified. Delegate the shared claim tail to ClaimTakeoverService.
    const { magicLinkSent } = await claimTakeover({
      admin,
      tokenRow,
      rawToken: input.token,
      email,
      origin,
      magicLinkRedirectTo: `${origin}/profile`,
    })

    return { ok: true as const, magicLinkSent }
  },
})
