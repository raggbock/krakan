import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleInviteCreate } from './index.ts'

Deno.test('rejects non-admin caller', async () => {
  const admin = {
    rpc: async () => ({ data: false, error: null }),
  }
  await assertRejects(
    () =>
      handleInviteCreate({
        input: { email: 'x@y.se' },
        userId: 'u1',
        inviterEmail: 'me@x.se',
        origin: 'https://fyndstigen.se',
        admin: admin as never,
        resendApiKey: 'k',
        fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      }),
    Error,
    'not_admin',
  )
})

Deno.test('happy path inserts invite and sends email', async () => {
  const state: { insertedRow: { email?: string } | null } = { insertedRow: null }
  const admin = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      if (table !== 'admin_invites' && table !== 'admin_actions') throw new Error('unexpected ' + table)
      return {
        insert: (row: Record<string, unknown>) => {
          if (table === 'admin_invites') state.insertedRow = row as { email?: string }
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'i1', expires_at: '2026-05-01T00:00:00Z' },
                error: null,
              }),
            }),
          }
        },
      }
    },
  }
  const fetchCalls: string[] = []
  const fakeFetch: typeof fetch = async (url) => {
    fetchCalls.push(String(url))
    return new Response(JSON.stringify({ id: 're_1' }), { status: 200 })
  }
  const { inviteId } = await handleInviteCreate({
    input: { email: 'x@y.se' },
    userId: 'u1',
    inviterEmail: 'me@x.se',
    origin: 'https://fyndstigen.se',
    admin: admin as never,
    resendApiKey: 'rk',
    fetchImpl: fakeFetch,
  })
  assertEquals(inviteId, 'i1')
  assertEquals(state.insertedRow?.email, 'x@y.se')
  assertEquals(fetchCalls[0], 'https://api.resend.com/emails')
})
