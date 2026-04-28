import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverRemovedNotificationEmail } from '../_shared/email-templates/takeover-removed.ts'
import { sha256Hex } from '../_shared/takeover-helpers.ts'
import {
  TakeoverRemoveInput,
  TakeoverRemoveOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

const NOTIFY_TO = 'info@fyndstigen.se'

definePublicEndpoint({
  name: 'takeover-remove',
  input: TakeoverRemoveInput,
  output: TakeoverRemoveOutput,
  handler: async ({ admin }, input) => {
    const tokenHash = await sha256Hex(input.token)
    // Pre-flight: confirm the token is real and still active. The atomic
    // RPC re-checks under a row lock, so this is purely for cleaner error
    // mapping (404 vs 410) before we mutate anything.
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

    // Fetch market info BEFORE the soft-delete so we can include name/city
    // in the admin notification mail. The RPC sets is_deleted = true,
    // which doesn't change name/city.
    const { data: market, error: mErr } = await admin
      .from('flea_markets')
      .select('name, city')
      .eq('id', tokenRow.flea_market_id)
      .single()
    if (mErr) throw new Error(mErr.message)

    const { error: rpcErr } = await admin.rpc('remove_via_takeover', {
      p_token_hash: tokenHash,
    })
    if (rpcErr) {
      if (rpcErr.message?.includes('token_already_used')) {
        throw new HttpError(410, 'token_already_used')
      }
      throw new Error(rpcErr.message)
    }

    // Best-effort admin notification. Failure here doesn't reverse the
    // removal — admin can find soft-deleted markets via is_deleted = true.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey) {
      const { html, text } = takeoverRemovedNotificationEmail({
        businessName: market.name as string,
        city: (market.city as string | null) ?? null,
        marketId: tokenRow.flea_market_id as string,
        reason: input.reason?.trim() ? input.reason.trim() : null,
      })
      try {
        await sendEmail({
          to: NOTIFY_TO,
          subject: `Loppis borttagen: ${market.name}`,
          html,
          text,
          from: DEFAULT_FROM,
          apiKey: resendApiKey,
        })
      } catch (err) {
        console.error('[takeover-remove] notify failed:', err)
      }
    }

    return { ok: true as const }
  },
})
