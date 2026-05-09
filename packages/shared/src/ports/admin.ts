/**
 * AdminPort — operations available to platform admins.
 *
 * Covers invite lifecycle (invite → accept → revoke), admin list management,
 * and the admin action log. Implementations: supabase/admin.ts (production),
 * in-memory/admin.ts (tests — includes a control handle for seeding).
 *
 * Authorization: callers must have a valid admin session; edge functions
 * enforce this via `defineEndpoint` + `isAdmin` guard.
 */
// packages/shared/src/ports/admin.ts

export type AdminRecord = {
  userId: string
  email: string
  grantedAt: string
  grantedBy: string | null
  notes: string | null
}

export type PendingInvite = {
  id: string
  email: string
  invitedBy: string
  createdAt: string
  expiresAt: string
}

export type AdminAction = {
  id: string
  adminUserId: string
  action: string
  targetType: string | null
  targetId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export type AdminPort = {
  listAdmins(): Promise<AdminRecord[]>
  listPendingInvites(): Promise<PendingInvite[]>
  listActions(params?: { limit?: number }): Promise<AdminAction[]>
  inviteAdmin(email: string): Promise<{ inviteId: string; expiresAt: string }>
  acceptInvite(token: string): Promise<void>
  revokeInvite(inviteId: string): Promise<void>
  revokeAdmin(userId: string): Promise<void>
  isAdmin(userId: string): Promise<boolean>
}
