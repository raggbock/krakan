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

  // The accept_admin_invite RPC bundles validation + admin_users upsert
  // + invite-mark + audit-row insert into one transaction. Removes the
  // TOCTOU window the previous procedural sequence had, and surfaces
  // any DB error (the previous code silently ignored the marker UPDATE
  // result, leaving the invite reusable on transient write failures).
  const { error } = await admin.rpc('accept_admin_invite', {
    p_token_hash: tokenHash,
    p_user_id: userId,
    p_user_email: userEmail,
    p_client_ip: clientIp,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('invite_not_found')) throw new HttpError(404, 'invite_not_found')
    if (msg.includes('invite_revoked')) throw new HttpError(410, 'invite_revoked')
    if (msg.includes('invite_already_accepted')) throw new HttpError(409, 'invite_already_accepted')
    if (msg.includes('invite_expired')) throw new HttpError(410, 'invite_expired')
    if (msg.includes('invite_email_mismatch')) throw new HttpError(403, 'invite_email_mismatch')
    throw new Error(msg)
  }

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
