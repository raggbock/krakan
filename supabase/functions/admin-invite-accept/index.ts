import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminInviteAcceptInput,
  AdminInviteAcceptOutput,
} from '@fyndstigen/shared/contracts/admin-invite-accept.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export type HandleInviteAcceptDeps = {
  input: { token: string }
  userId: string
  userEmail: string
  clientIp: string
  admin: SupabaseClient
}

export async function handleInviteAccept(
  deps: HandleInviteAcceptDeps,
): Promise<{ ok: true }> {
  const { admin, userId, userEmail, clientIp, input } = deps

  const tokenHash = await hashToken(input.token)

  const { data: invite, error: lookupErr } = await admin
    .from('admin_invites')
    .select('id, email, token_hash, expires_at, accepted_at, revoked_at, invited_by')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (lookupErr) throw new Error(lookupErr.message)
  if (!invite) throw new HttpError(404, 'invite_not_found')
  if (invite.revoked_at) throw new HttpError(410, 'invite_revoked')
  if (invite.accepted_at) throw new HttpError(409, 'invite_already_accepted')
  if (Date.parse(invite.expires_at) < Date.now()) throw new HttpError(410, 'invite_expired')
  if (invite.email !== userEmail) throw new HttpError(403, 'invite_email_mismatch')
  if (!timingSafeEqual(invite.token_hash, tokenHash)) throw new HttpError(403, 'invite_hash_mismatch')

  await admin.from('admin_users').upsert(
    {
      user_id: userId,
      granted_at: new Date().toISOString(),
      granted_by: invite.invited_by,
      revoked_at: null,
    },
    { onConflict: 'user_id' },
  )

  await admin
    .from('admin_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
      accepted_from_ip: clientIp,
    })
    .eq('id', invite.id)

  await admin.from('admin_actions').insert({
    admin_user_id: userId,
    action: 'admin.invite.accepted',
    target_type: 'admin_user',
    target_id: userId,
    payload: { inviteId: invite.id },
  })

  return { ok: true }
}

defineEndpoint({
  name: 'admin-invite-accept',
  input: AdminInviteAcceptInput,
  output: AdminInviteAcceptOutput,
  handler: async ({ user, admin, req }, input) => {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('cf-connecting-ip') ??
      ''
    return handleInviteAccept({
      input,
      userId: user.id,
      userEmail: user.email ?? '',
      clientIp,
      admin,
    })
  },
})
