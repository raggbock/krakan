import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverFeedbackEmail } from '../_shared/email-templates/takeover-feedback.ts'
import { sha256Hex } from '../_shared/takeover-helpers.ts'
import {
  TakeoverFeedbackInput,
  TakeoverFeedbackOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

const FEEDBACK_TO = 'info@fyndstigen.se'

definePublicEndpoint({
  name: 'takeover-feedback',
  input: TakeoverFeedbackInput,
  output: TakeoverFeedbackOutput,
  handler: async ({ admin }, input) => {
    const tokenHash = await sha256Hex(input.token)
    const { data: tokenRow, error } = await admin
      .from('business_owner_tokens')
      .select('flea_market_id, used_at, invalidated_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!tokenRow) throw new HttpError(404, 'token_not_found')
    if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
    if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
    if (Date.parse(tokenRow.expires_at) < Date.now()) throw new HttpError(410, 'token_expired')

    const { data: market, error: mErr } = await admin
      .from('flea_markets')
      .select('name, city, is_deleted')
      .eq('id', tokenRow.flea_market_id)
      .single()
    if (mErr) throw new Error(mErr.message)
    if (market.is_deleted) throw new HttpError(410, 'market_removed')

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')

    const businessName = market.name as string
    const city = (market.city as string | null) ?? null
    const { html, text } = takeoverFeedbackEmail({
      businessName,
      city,
      fromEmail: input.email,
      message: input.message,
    })
    await sendEmail({
      to: FEEDBACK_TO,
      subject: `Ändringsförslag: ${businessName}`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })

    return { ok: true as const }
  },
})
