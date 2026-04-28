import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverFeedbackEmail } from '../_shared/email-templates/takeover-feedback.ts'
import { validateTakeoverToken } from '../_shared/takeover-token.ts'
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
    const tokenRow = await validateTakeoverToken(admin, input.token)

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
