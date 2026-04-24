import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { adminInviteEmail } from '../_shared/email-templates/admin-invite.ts'
import {
  AdminInviteCreateInput,
  AdminInviteCreateOutput,
} from '@fyndstigen/shared/contracts/admin-invite-create.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type HandleInviteCreateDeps = {
  input: { email: string }
  userId: string
  inviterEmail: string
  origin: string
  admin: SupabaseClient
  resendApiKey: string
  fetchImpl?: typeof fetch
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export async function handleInviteCreate(
  deps: HandleInviteCreateDeps,
): Promise<{ inviteId: string; expiresAt: string }> {
  const { admin, userId, inviterEmail, origin, input, resendApiKey } = deps

  const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: userId })
  if (rpcErr) throw new Error(rpcErr.message)
  if (!isAdminResult) throw new HttpError(403, 'not_admin')

  const token = generateToken()
  const tokenHash = await hashToken(token)

  const { data: invite, error: insErr } = await admin
    .from('admin_invites')
    .insert({
      email: input.email,
      token_hash: tokenHash,
      invited_by: userId,
    })
    .select('id, expires_at')
    .single()
  if (insErr) throw new Error(insErr.message)

  const acceptUrl = `${origin}/admin/invite/accept?token=${encodeURIComponent(token)}`
  const { html, text } = adminInviteEmail({ inviterEmail, acceptUrl })
  await sendEmail({
    to: input.email,
    subject: 'Välkommen som Fyndstigen-admin',
    html,
    text,
    from: DEFAULT_FROM,
    apiKey: resendApiKey,
    fetchImpl: deps.fetchImpl,
  })

  await admin.from('admin_actions').insert({
    admin_user_id: userId,
    action: 'admin.invite.sent',
    target_type: 'email',
    target_id: input.email,
    payload: { inviteId: invite.id },
  })

  return { inviteId: invite.id, expiresAt: invite.expires_at }
}

defineEndpoint({
  name: 'admin-invite-create',
  input: AdminInviteCreateInput,
  output: AdminInviteCreateOutput,
  handler: async ({ user, admin, origin }, input) => {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')
    return handleInviteCreate({
      input,
      userId: user.id,
      inviterEmail: user.email ?? '',
      origin,
      admin,
      resendApiKey,
    })
  },
})
