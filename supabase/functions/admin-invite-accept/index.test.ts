import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleInviteAccept } from './index.ts'

function fakeAdmin(invite: Record<string, unknown> | null) {
  const calls: { table: string; op: string; row?: unknown }[] = []
  return {
    calls,
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: invite, error: null }),
        }),
      }),
      update: (row: unknown) => {
        calls.push({ table, op: 'update', row })
        return { eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      },
      upsert: (row: unknown) => {
        calls.push({ table, op: 'upsert', row })
        return Promise.resolve({ error: null })
      },
      insert: (row: unknown) => {
        calls.push({ table, op: 'insert', row })
        return Promise.resolve({ error: null })
      },
    }),
  } as never
}

Deno.test('rejects expired invite', async () => {
  const admin = fakeAdmin({
    id: 'i1',
    email: 'x@y.se',
    token_hash: 'hashed',
    expires_at: '2020-01-01T00:00:00Z',
    accepted_at: null,
    revoked_at: null,
  })
  await assertRejects(
    () =>
      handleInviteAccept({
        input: { token: 'anything' },
        userId: 'u1',
        userEmail: 'x@y.se',
        clientIp: '1.1.1.1',
        admin,
      }),
    Error,
    'invite_expired',
  )
})

Deno.test('rejects email mismatch', async () => {
  const admin = fakeAdmin({
    id: 'i1',
    email: 'other@x.se',
    token_hash: 'hashed',
    expires_at: '2099-01-01T00:00:00Z',
    accepted_at: null,
    revoked_at: null,
  })
  await assertRejects(
    () =>
      handleInviteAccept({
        input: { token: 'anything' },
        userId: 'u1',
        userEmail: 'x@y.se',
        clientIp: '1.1.1.1',
        admin,
      }),
    Error,
    'invite_email_mismatch',
  )
})
