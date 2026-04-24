import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { takeoverInviteEmail } from '../_shared/email-templates/takeover-invite.ts'
import { sha256Hex } from '../_shared/takeover-helpers.ts'
import {
  AdminTakeoverSendInput,
  AdminTakeoverSendOutput,
} from '@fyndstigen/shared/contracts/admin-takeover-send'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function sendOne(
  admin: SupabaseClient,
  marketId: string,
  origin: string,
  resendApiKey: string,
): Promise<{ status: 'sent' | 'skipped' | 'error'; email: string | null; reason: string | null }> {
  const { data: market, error: mErr } = await admin
    .from('flea_markets')
    .select('id, name, city, contact_email, is_system_owned')
    .eq('id', marketId)
    .single()
  if (mErr) return { status: 'error', email: null, reason: mErr.message }
  if (!market.is_system_owned) return { status: 'skipped', email: null, reason: 'already_owned' }
  const email = (market.contact_email as string | null)?.trim() ?? null
  if (!email) return { status: 'skipped', email: null, reason: 'no_contact_email' }

  // Invalidate any existing active tokens for this market.
  await admin
    .from('business_owner_tokens')
    .update({ invalidated_at: new Date().toISOString() })
    .eq('flea_market_id', marketId)
    .is('used_at', null)
    .is('invalidated_at', null)

  // Generate fresh token + insert.
  const token = generateToken()
  const tokenHash = await sha256Hex(token)
  const { data: inserted, error: insErr } = await admin
    .from('business_owner_tokens')
    .insert({
      flea_market_id: marketId,
      token_hash: tokenHash,
      sent_to_email: email,
      sent_at: new Date().toISOString(),
      should_send_email: true,
      priority: 2,
    })
    .select('id')
    .single()
  if (insErr) return { status: 'error', email, reason: insErr.message }

  const takeoverUrl = `${origin}/takeover/${token}`
  const { html, text } = takeoverInviteEmail({
    businessName: market.name as string,
    city: (market.city as string | null) ?? null,
    takeoverUrl,
  })
  try {
    await sendEmail({
      to: email,
      subject: `Ta över ${market.name} på Fyndstigen`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })
  } catch (err) {
    // Roll back the token row so we don't leave dangling invites.
    await admin.from('business_owner_tokens').delete().eq('id', inserted.id)
    return {
      status: 'error',
      email,
      reason: err instanceof Error ? err.message : 'send_failed',
    }
  }

  return { status: 'sent', email, reason: null }
}

defineEndpoint({
  name: 'admin-takeover-send',
  input: AdminTakeoverSendInput,
  output: AdminTakeoverSendOutput,
  handler: async ({ user, admin, origin }, input) => {
    const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: user.id })
    if (rpcErr) throw new Error(rpcErr.message)
    if (!isAdminResult) throw new HttpError(403, 'not_admin')

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')

    // The /takeover route lives on the web origin, not the edge origin.
    // Trust the request's Origin header (sent by the admin UI).
    const results = await Promise.all(
      input.marketIds.map((id) =>
        sendOne(admin, id, origin, resendApiKey).then((r) => ({ marketId: id, ...r })),
      ),
    )

    const summary = {
      sent: results.filter((r) => r.status === 'sent').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
    }

    await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'business.takeover.send',
      target_type: 'batch',
      target_id: null,
      payload: summary,
    })

    return { results, summary }
  },
})
