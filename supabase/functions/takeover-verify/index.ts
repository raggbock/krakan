import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverMagicLinkEmail } from '../_shared/email-templates/takeover-code.ts'
import {
  MAX_CODE_ATTEMPTS,
  sha256Hex,
  timingSafeEqualHex,
} from '../_shared/takeover-helpers.ts'
import {
  TakeoverVerifyInput,
  TakeoverVerifyOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

definePublicEndpoint({
  name: 'takeover-verify',
  input: TakeoverVerifyInput,
  output: TakeoverVerifyOutput,
  handler: async ({ admin, origin }, input) => {
    const tokenHash = await sha256Hex(input.token)
    const email = input.email.toLowerCase()

    const { data: tokenRow, error } = await admin
      .from('business_owner_tokens')
      .select('id, flea_market_id, used_at, invalidated_at, expires_at, verification_email, verification_code_hash, verification_code_expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!tokenRow) throw new HttpError(404, 'token_not_found')
    if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
    if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
    if (Date.parse(tokenRow.expires_at) < Date.now()) throw new HttpError(410, 'token_expired')

    if (!tokenRow.verification_code_hash || !tokenRow.verification_email) {
      throw new HttpError(400, 'no_code_sent')
    }
    if (tokenRow.verification_email !== email) throw new HttpError(400, 'email_mismatch')
    if (Date.parse(tokenRow.verification_code_expires_at as string) < Date.now()) {
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
    const matches = timingSafeEqualHex(codeHash, tokenRow.verification_code_hash as string)
    if (!matches) throw new HttpError(400, 'code_invalid')

    // --- Verified. Transfer ownership. ---

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

    // Mark token used BEFORE transferring ownership. If the ownership
    // UPDATE then fails, the token is spent and admin must reissue — but
    // no concurrent caller can race in and re-transfer the market. Order
    // matters: the token is our single-use guard.
    const { data: markedRow, error: useErr } = await admin
      .from('business_owner_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle()
    if (useErr) throw new Error(useErr.message)
    if (!markedRow) throw new HttpError(410, 'token_already_used')

    const { error: mktErr } = await admin
      .from('flea_markets')
      .update({ organizer_id: userId, is_system_owned: false })
      .eq('id', tokenRow.flea_market_id)
    if (mktErr) throw new Error(mktErr.message)

    const { data: market, error: marketErr } = await admin
      .from('flea_markets')
      .select('name')
      .eq('id', tokenRow.flea_market_id)
      .single()
    if (marketErr) console.error('[takeover-verify] market fetch failed:', marketErr.message)

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/profile/my-markets` },
    })
    if (linkErr) throw new Error(linkErr.message)

    let magicLinkSent = false
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const actionLink = linkData.properties?.action_link
    if (resendApiKey && actionLink) {
      const { html, text } = takeoverMagicLinkEmail({
        magicLink: actionLink,
        businessName: (market?.name as string) ?? 'din butik',
      })
      await sendEmail({
        to: email,
        subject: 'Slutför inloggning till Fyndstigen',
        html,
        text,
        from: DEFAULT_FROM,
        apiKey: resendApiKey,
      })
      magicLinkSent = true
    }

    return { ok: true as const, magicLinkSent }
  },
})
