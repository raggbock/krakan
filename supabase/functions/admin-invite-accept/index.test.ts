import { assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleInviteAccept } from './index.ts'

// The accept logic now lives in the accept_admin_invite Postgres
// function — these unit tests assert that the edge function correctly
// translates the RPC's typed errors into HttpError status codes.

function fakeAdminWithRpcError(message: string) {
  return {
    rpc: async () => ({ data: null, error: { message } }),
  } as never
}

Deno.test('maps invite_expired error to HttpError', async () => {
  const admin = fakeAdminWithRpcError('invite_expired')
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

Deno.test('maps invite_email_mismatch error to HttpError', async () => {
  const admin = fakeAdminWithRpcError('invite_email_mismatch')
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

Deno.test('maps invite_already_accepted error to HttpError', async () => {
  const admin = fakeAdminWithRpcError('invite_already_accepted')
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
    'invite_already_accepted',
  )
})

Deno.test('maps invite_not_found error to HttpError', async () => {
  const admin = fakeAdminWithRpcError('invite_not_found')
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
    'invite_not_found',
  )
})
