import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverMagicLinkEmail } from '../_shared/email-templates/takeover-code.ts'
import { sha256Hex } from '../_shared/takeover-helpers.ts'
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
 * Replaces the previous start → 6-digit-code → verify two-step. Same
 * security model (must control the recipient inbox to receive the
 * magic-link), one fewer email + one fewer typing step. takeover-verify
 * stays deployed for ~2 weeks so anyone who already received a code from
 * the old flow can still finish their claim.
 */
definePublicEndpoint({
  name: 'takeover-start',
  input: TakeoverStartInput,
  output: TakeoverStartOutput,
  handler: async ({ admin, origin }, input) => {
    const tokenHash = await sha256Hex(input.token)
    const submittedEmail = input.email.toLowerCase()

    const { data: tokenRow, error } = await admin
      .from('business_owner_tokens')
      .select('id, flea_market_id, used_at, invalidated_at, expires_at, sent_to_email')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!tokenRow) throw new HttpError(404, 'token_not_found')
    if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
    if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
    if (Date.parse(tokenRow.expires_at) < Date.now()) throw new HttpError(410, 'token_expired')

    const expectedEmail = (tokenRow.sent_to_email as string | null)?.trim().toLowerCase()
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

    // Resolve auth user — create if missing. email_confirm: true so the
    // magic-link can sign them in directly. (See takeover-verify for the
    // history of why ordering this BEFORE claim_takeover_atomic matters.)
    const { data: existing, error: lookupErr } = await admin
      .from('auth_user_email_view')
      .select('id')
      .eq('email', submittedEmail)
      .maybeSingle()
    if (lookupErr) throw new Error(lookupErr.message)
    let userId = existing?.id as string | undefined
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: submittedEmail,
        email_confirm: true,
      })
      if (createErr) throw new Error(createErr.message)
      userId = created.user.id
    }

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

    // Magic-link redirects straight to the claimed market's slug page —
    // visitors immediately see their newly-owned listing with the draft
    // banner (or a fresh edit link if already published).
    const slug = market.slug as string | null
    const redirectTo = slug ? `${origin}/loppis/${slug}?from=takeover` : `${origin}/profile`

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: submittedEmail,
      options: { redirectTo },
    })
    if (linkErr) throw new Error(linkErr.message)
    const actionLink = linkData.properties?.action_link
    if (!actionLink) throw new HttpError(500, 'magic_link_missing')

    const { html, text } = takeoverMagicLinkEmail({
      magicLink: actionLink,
      businessName: (market.name as string) ?? 'din butik',
    })
    await sendEmail({
      to: submittedEmail,
      subject: `Logga in på Fyndstigen — ${market.name}`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })

    return { ok: true as const, magicLinkSent: true }
  },
})
