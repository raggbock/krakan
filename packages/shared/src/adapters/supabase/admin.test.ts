import { describe, it, expect, vi } from 'vitest'
import { createSupabaseAdmin } from './admin'

describe('createSupabaseAdmin', () => {
  it('isAdmin calls rpc("is_admin") with the user id', async () => {
    const client = {
      from: () => ({}),
      rpc: vi.fn(async () => ({ data: true, error: null })),
      functions: { invoke: vi.fn() },
    } as never
    const admin = createSupabaseAdmin(client)
    expect(await admin.isAdmin('u1')).toBe(true)
    expect((client as any).rpc).toHaveBeenCalledWith('is_admin', { uid: 'u1' })
  })

  it('inviteAdmin calls functions.invoke("admin-invite-create")', async () => {
    const client = {
      from: () => ({}),
      rpc: vi.fn(),
      functions: {
        invoke: vi.fn(async () => ({
          data: { inviteId: 'i1', expiresAt: '2026-05-01T00:00:00Z' },
          error: null,
        })),
      },
    } as never
    const admin = createSupabaseAdmin(client)
    const r = await admin.inviteAdmin('x@y.se')
    expect(r.inviteId).toBe('i1')
    expect((client as any).functions.invoke).toHaveBeenCalledWith('admin-invite-create', {
      body: { email: 'x@y.se' },
    })
  })
})
