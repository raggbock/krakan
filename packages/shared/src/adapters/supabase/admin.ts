import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminPort,
  AdminRecord,
  PendingInvite,
  AdminAction,
} from '../../ports/admin'

function invokeOrThrow<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  if (res.data == null) throw new Error('empty response')
  return res.data
}

export function createSupabaseAdmin(supabase: SupabaseClient): AdminPort {
  return {
    async listAdmins() {
      // Two-step: fetch admins, then bulk-fetch emails via a security-
      // definer RPC (admin_user_emails). The view itself is no longer
      // grantable to authenticated since migration 00024 — direct SELECT
      // would leak every email on the platform.
      const { data: admins, error } = await supabase
        .from('admin_users')
        .select('user_id, granted_at, granted_by, notes')
        .is('revoked_at', null)
        .order('granted_at', { ascending: false })
      if (error) throw error
      const rows = admins ?? []
      if (rows.length === 0) return []

      const userIds = rows.map((r) => r.user_id as string)
      const { data: users, error: usersErr } = await supabase
        .rpc('admin_user_emails', { user_ids: userIds })
      if (usersErr) throw usersErr
      const emailById = new Map<string, string>(
        ((users ?? []) as Array<{ id: string; email: string }>).map((u) => [u.id, u.email ?? '']),
      )

      return rows.map((row) => ({
        userId: row.user_id as string,
        email: emailById.get(row.user_id as string) ?? '',
        grantedAt: row.granted_at as string,
        grantedBy: (row.granted_by as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
      })) as AdminRecord[]
    },

    async listPendingInvites() {
      const { data, error } = await supabase
        .from('admin_invites')
        .select('id, email, invited_by, created_at, expires_at')
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        invitedBy: row.invited_by,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })) as PendingInvite[]
    },

    async listActions(params) {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('id, admin_user_id, action, target_type, target_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(params?.limit ?? 50)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        payload: row.payload ?? {},
        createdAt: row.created_at,
      })) as AdminAction[]
    },

    async inviteAdmin(email) {
      const res = await supabase.functions.invoke('admin-invite-create', { body: { email } })
      return invokeOrThrow<{ inviteId: string; expiresAt: string }>(res as never)
    },
    async acceptInvite(token) {
      const res = await supabase.functions.invoke('admin-invite-accept', { body: { token } })
      invokeOrThrow<{ ok: true }>(res as never)
    },
    async revokeInvite(inviteId) {
      const res = await supabase.functions.invoke('admin-invite-revoke', { body: { inviteId } })
      invokeOrThrow<{ ok: true }>(res as never)
    },
    async revokeAdmin(userId) {
      const res = await supabase.functions.invoke('admin-revoke', { body: { userId } })
      invokeOrThrow<{ ok: true }>(res as never)
    },
    async isAdmin(userId) {
      const { data, error } = await supabase.rpc('is_admin', { uid: userId })
      if (error) throw error
      return !!data
    },
  }
}
