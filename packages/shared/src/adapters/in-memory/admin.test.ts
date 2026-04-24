import { describe, it, expect } from 'vitest'
import { createInMemoryAdmin } from './admin'

describe('createInMemoryAdmin', () => {
  it('starts empty', async () => {
    const { repo } = createInMemoryAdmin()
    expect(await repo.listAdmins()).toEqual([])
    expect(await repo.listPendingInvites()).toEqual([])
    expect(await repo.listActions()).toEqual([])
  })

  it('inviteAdmin adds a pending invite', async () => {
    const { repo, control } = createInMemoryAdmin()
    control.setCurrentUser('u-admin')
    control.seedAdmin({ userId: 'u-admin', email: 'boss@x.se' })
    const { inviteId, expiresAt } = await repo.inviteAdmin('new@x.se')
    expect(inviteId).toMatch(/.+/)
    expect(expiresAt).toMatch(/\d{4}-\d{2}-\d{2}/)
    const pending = await repo.listPendingInvites()
    expect(pending).toHaveLength(1)
    expect(pending[0].email).toBe('new@x.se')
  })

  it('acceptInvite moves pending → admin and clears pending list', async () => {
    const { repo, control } = createInMemoryAdmin()
    control.setCurrentUser('u-admin')
    control.seedAdmin({ userId: 'u-admin', email: 'boss@x.se' })
    await repo.inviteAdmin('new@x.se')
    const token = control.lastGeneratedToken()
    control.setCurrentUser('u-new')
    control.setCurrentEmail('new@x.se')
    await repo.acceptInvite(token)
    expect(await repo.listPendingInvites()).toHaveLength(0)
    const admins = await repo.listAdmins()
    expect(admins.map((a) => a.userId).sort()).toEqual(['u-admin', 'u-new'])
  })

  it('revokeAdmin refuses to leave zero active admins', async () => {
    const { repo, control } = createInMemoryAdmin()
    control.setCurrentUser('u-only')
    control.seedAdmin({ userId: 'u-only', email: 'a@x.se' })
    await expect(repo.revokeAdmin('u-only')).rejects.toThrow(/last admin/i)
  })
})
