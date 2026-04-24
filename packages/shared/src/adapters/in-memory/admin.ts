import type {
  AdminPort,
  AdminRecord,
  PendingInvite,
  AdminAction,
} from '../../ports/admin'

type Invite = PendingInvite & { tokenHash: string; acceptedAt?: string; revokedAt?: string }
type Admin = AdminRecord & { revokedAt?: string }

export type InMemoryAdminControl = {
  setCurrentUser(id: string): void
  setCurrentEmail(email: string): void
  seedAdmin(admin: { userId: string; email: string }): void
  lastGeneratedToken(): string
  reset(): void
}

export function createInMemoryAdmin(): { repo: AdminPort; control: InMemoryAdminControl } {
  const admins = new Map<string, Admin>()
  const invites = new Map<string, Invite>()
  const actions: AdminAction[] = []
  let currentUser = ''
  let currentEmail = ''
  let lastToken = ''
  let nextId = 1

  function nowIso() {
    return new Date().toISOString()
  }
  function requireAdmin() {
    const a = admins.get(currentUser)
    if (!a || a.revokedAt) throw new Error('not_admin')
  }
  function activeAdminsCount() {
    return Array.from(admins.values()).filter((a) => !a.revokedAt).length
  }
  function log(action: string, targetType: string | null, targetId: string | null, payload = {}) {
    actions.push({
      id: `act-${nextId++}`,
      adminUserId: currentUser,
      action,
      targetType,
      targetId,
      payload,
      createdAt: nowIso(),
    })
  }

  const repo: AdminPort = {
    async listAdmins() {
      return Array.from(admins.values())
        .filter((a) => !a.revokedAt)
        .map(({ revokedAt: _r, ...rest }) => rest)
    },
    async listPendingInvites() {
      return Array.from(invites.values())
        .filter((i) => !i.acceptedAt && !i.revokedAt)
        .map(({ tokenHash: _t, acceptedAt: _a, revokedAt: _r, ...rest }) => rest)
    },
    async listActions(params) {
      const limit = params?.limit ?? 50
      return actions.slice(-limit).reverse()
    },
    async inviteAdmin(email) {
      requireAdmin()
      const token = `tok-${nextId++}-${Math.random().toString(36).slice(2)}`
      lastToken = token
      const id = `inv-${nextId++}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      invites.set(id, {
        id,
        email,
        invitedBy: currentUser,
        createdAt: nowIso(),
        expiresAt,
        tokenHash: token,
      })
      log('admin.invite.sent', 'email', email)
      return { inviteId: id, expiresAt }
    },
    async acceptInvite(token) {
      const invite = Array.from(invites.values()).find((i) => i.tokenHash === token)
      if (!invite) throw new Error('invite_not_found')
      if (invite.acceptedAt) throw new Error('invite_already_accepted')
      if (invite.revokedAt) throw new Error('invite_revoked')
      if (Date.parse(invite.expiresAt) < Date.now()) throw new Error('invite_expired')
      if (invite.email !== currentEmail) throw new Error('invite_email_mismatch')
      admins.set(currentUser, {
        userId: currentUser,
        email: currentEmail,
        grantedAt: nowIso(),
        grantedBy: invite.invitedBy,
        notes: null,
      })
      invite.acceptedAt = nowIso()
      log('admin.invite.accepted', 'admin_user', currentUser)
    },
    async revokeInvite(inviteId) {
      requireAdmin()
      const invite = invites.get(inviteId)
      if (!invite) throw new Error('invite_not_found')
      invite.revokedAt = nowIso()
      log('admin.invite.revoked', 'admin_invite', inviteId)
    },
    async revokeAdmin(userId) {
      requireAdmin()
      if (activeAdminsCount() <= 1) throw new Error('cannot_revoke_last_admin')
      const a = admins.get(userId)
      if (!a) throw new Error('admin_not_found')
      a.revokedAt = nowIso()
      log('admin.revoked', 'admin_user', userId)
    },
    async isAdmin(userId) {
      const a = admins.get(userId)
      return !!a && !a.revokedAt
    },
  }

  const control: InMemoryAdminControl = {
    setCurrentUser: (id) => { currentUser = id },
    setCurrentEmail: (email) => { currentEmail = email },
    seedAdmin: ({ userId, email }) => {
      admins.set(userId, {
        userId,
        email,
        grantedAt: nowIso(),
        grantedBy: null,
        notes: null,
      })
    },
    lastGeneratedToken: () => lastToken,
    reset: () => {
      admins.clear()
      invites.clear()
      actions.length = 0
      currentUser = ''
      currentEmail = ''
      lastToken = ''
    },
  }

  return { repo, control }
}
