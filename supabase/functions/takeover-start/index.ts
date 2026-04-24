import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverCodeEmail } from '../_shared/email-templates/takeover-code.ts'
import {
  CODE_TTL_MS,
  generateCode,
  sha256Hex,
} from '../_shared/takeover-helpers.ts'
import {
  TakeoverStartInput,
  TakeoverStartOutput,
} from '@fyndstigen/shared/contracts/takeover'

definePublicEndpoint({
  name: 'takeover-start',
  input: TakeoverStartInput,
  output: TakeoverStartOutput,
  handler: async ({ admin }, input) => {
    const tokenHash = await sha256Hex(input.token)
    const { data: tokenRow, error } = await admin
      .from('business_owner_tokens')
      .select('id, flea_market_id, used_at, invalidated_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!tokenRow) throw new HttpError(404, 'token_not_found')
    if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
    if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
    if (Date.parse(tokenRow.expires_at) < Date.now()) throw new HttpError(410, 'token_expired')

    const { data: market, error: mErr } = await admin
      .from('flea_markets')
      .select('name')
      .eq('id', tokenRow.flea_market_id)
      .single()
    if (mErr) throw new Error(mErr.message)

    const code = generateCode()
    const codeHash = await sha256Hex(code)
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

    const { error: updErr } = await admin
      .from('business_owner_tokens')
      .update({
        verification_email: input.email.toLowerCase(),
        verification_code_hash: codeHash,
        verification_code_expires_at: expiresAt,
        verification_attempts: 0,
      })
      .eq('id', tokenRow.id)
    if (updErr) throw new Error(updErr.message)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')

    const { html, text } = takeoverCodeEmail({ code, businessName: market.name as string })
    await sendEmail({
      to: input.email,
      subject: `Verifieringskod: ${code}`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })

    return { ok: true as const, expiresAt }
  },
})
