import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverRequestEmail } from '../_shared/email-templates/takeover-request.ts'
import {
  TakeoverRequestInput,
  TakeoverRequestOutput,
} from '@fyndstigen/shared/contracts/takeover-request.ts'

const NOTIFY_TO = 'info@fyndstigen.se'

/**
 * Caps to keep admin inbox sane and a determined attacker from spamming
 * us. Limits are deliberately gentle — a real organizer might submit 1-2
 * requests with different notes; spam is orders of magnitude worse.
 */
const MAX_REQUESTS_PER_MARKET_24H = 3
const MAX_REQUESTS_PER_EMAIL_24H = 10

definePublicEndpoint({
  name: 'takeover-request',
  input: TakeoverRequestInput,
  output: TakeoverRequestOutput,
  handler: async ({ admin, origin }, input) => {
    const email = input.email.toLowerCase()
    const note = input.note?.trim() || null

    // Confirm the market exists, isn't deleted, and is still up for grabs.
    // We don't accept claims on already-owned markets — the rightful
    // organizer can already log in and edit through the normal flow.
    const { data: market, error: mErr } = await admin
      .from('flea_markets')
      .select('id, name, slug, city, is_deleted, is_system_owned')
      .eq('id', input.marketId)
      .single()
    if (mErr) throw new HttpError(404, 'market_not_found')
    if (market.is_deleted) throw new HttpError(410, 'market_removed')
    if (!market.is_system_owned) throw new HttpError(409, 'market_already_claimed')

    // Rate limit: per-market and per-email, both over a rolling 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: marketCount, error: mcErr } = await admin
      .from('takeover_requests')
      .select('id', { count: 'exact', head: true })
      .eq('flea_market_id', input.marketId)
      .gte('created_at', since)
    if (mcErr) throw new Error(mcErr.message)
    if ((marketCount ?? 0) >= MAX_REQUESTS_PER_MARKET_24H) {
      throw new HttpError(429, 'too_many_requests_for_market')
    }
    const { count: emailCount, error: ecErr } = await admin
      .from('takeover_requests')
      .select('id', { count: 'exact', head: true })
      .ilike('requester_email', email)
      .gte('created_at', since)
    if (ecErr) throw new Error(ecErr.message)
    if ((emailCount ?? 0) >= MAX_REQUESTS_PER_EMAIL_24H) {
      throw new HttpError(429, 'too_many_requests_for_email')
    }

    // Insert the request (also serves as the rate-limit ledger above).
    const { error: insErr } = await admin.from('takeover_requests').insert({
      flea_market_id: input.marketId,
      requester_email: email,
      note,
    })
    if (insErr) throw new Error(insErr.message)

    // Notify admin. Failure here doesn't reverse the insert — admin can
    // catch up via the dashboard if Resend hiccups.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey) {
      const { html, text } = takeoverRequestEmail({
        marketName: market.name as string,
        marketCity: (market.city as string | null) ?? null,
        marketSlug: (market.slug as string | null) ?? null,
        marketId: market.id as string,
        requesterEmail: email,
        note,
        adminUrl: origin,
      })
      try {
        await sendEmail({
          to: NOTIFY_TO,
          subject: `Takeover-förfrågan: ${market.name}`,
          html,
          text,
          from: DEFAULT_FROM,
          apiKey: resendApiKey,
        })
      } catch (err) {
        console.error('[takeover-request] notify failed:', err)
      }
    }

    return { ok: true as const }
  },
})
