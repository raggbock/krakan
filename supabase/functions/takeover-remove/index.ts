import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM, type SendEmailOpts } from '../_shared/email.ts'
import { takeoverRemovedNotificationEmail } from '../_shared/email-templates/takeover-removed.ts'
import { validateTakeoverToken } from '../_shared/takeover-token.ts'
import { sha256Hex } from '../_shared/takeover-helpers.ts'
import {
  TakeoverRemoveInput,
  TakeoverRemoveOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NOTIFY_TO = 'info@fyndstigen.se'

export type HandleTakeoverRemoveDeps = {
  admin: SupabaseClient
  input: { token: string; reason?: string }
  resendApiKey: string | undefined
  fetchImpl?: SendEmailOpts['fetchImpl']
}

export async function handleTakeoverRemove(deps: HandleTakeoverRemoveDeps): Promise<{ ok: true }> {
  const { admin, input, resendApiKey, fetchImpl } = deps

  // Pre-flight: confirm the token is real and still active. The atomic
  // RPC re-checks under a row lock, so this is purely for cleaner error
  // mapping (404 vs 410) before we mutate anything.
  const tokenRow = await validateTakeoverToken(admin, input.token)

  // Fetch market info BEFORE the soft-delete so we can include name/city
  // in the admin notification mail. The RPC sets is_deleted = true,
  // which doesn't change name/city.
  const { data: market, error: mErr } = await admin
    .from('flea_markets')
    .select('name, city')
    .eq('id', tokenRow.flea_market_id)
    .single()
  if (mErr) throw new Error(mErr.message)

  const tokenHash = await sha256Hex(input.token)
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
  if (resendApiKey) {
    const { html, text } = takeoverRemovedNotificationEmail({
      businessName: market.name as string,
      city: (market.city as string | null) ?? null,
      marketId: tokenRow.flea_market_id,
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
        fetchImpl,
      })
    } catch (err) {
      console.error('[takeover-remove] notify failed:', err)
    }
  }

  return { ok: true as const }
}

definePublicEndpoint({
  name: 'takeover-remove',
  input: TakeoverRemoveInput,
  output: TakeoverRemoveOutput,
  handler: ({ admin }, input) =>
    handleTakeoverRemove({
      admin,
      input,
      resendApiKey: Deno.env.get('RESEND_API_KEY'),
    }),
})
