import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleBlockSaleStandConfirm } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAND_ID = '00000000-0000-0000-0000-000000000001'
const ORGANIZER_ID = '00000000-0000-0000-0000-000000000002'
const BLOCK_SALE_SLUG = 'regnbagsgatan-kvartersloppis-2025'
const BLOCK_SALE_NAME = 'Regnbågsgatan Kvartersloppis'

/**
 * Minimal fluent query builder. Plain object (not Proxy) so `await builder`
 * does not accidentally resolve via the `.then` property check.
 */
function makeFluentBuilder(result: { data: unknown; error: unknown }) {
  const terminal = () => Promise.resolve(result)
  type Builder = Record<string, (...args: unknown[]) => Builder | Promise<unknown>>
  function make(): Builder {
    return {
      select: () => make(),
      eq: () => make(),
      update: () => make(),
      maybeSingle: terminal,
      single: terminal,
    }
  }
  return make()
}

function makeStand(status: string) {
  return {
    id: STAND_ID,
    status,
    applicant_name: 'Anna Svensson',
    block_sales: {
      id: 'bs-001',
      name: BLOCK_SALE_NAME,
      slug: BLOCK_SALE_SLUG,
      organizer_id: ORGANIZER_ID,
    },
  }
}

function fakeAdmin({
  stand = makeStand('pending') as ReturnType<typeof makeStand> | null,
  updateError = null as { message: string } | null,
  organizerEmail = 'organizer@example.com' as string | null,
} = {}) {
  return {
    from: (table: string) => {
      if (table === 'block_sale_stands') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: stand, error: null }),
            }),
          }),
          update: (_data: unknown) => ({
            eq: () => Promise.resolve({ data: null, error: updateError }),
          }),
        }
      }
      return makeFluentBuilder({ data: null, error: { message: `unknown table: ${table}` } })
    },
    auth: {
      admin: {
        getUserById: (_id: string) =>
          Promise.resolve({
            data: organizerEmail ? { user: { email: organizerEmail } } : null,
            error: null,
          }),
      },
    },
  } as never
}

/** Token that verifies as the given standId */
function makeVerifyToken(standId: string) {
  return async (_token: string) => ({ standId, iat: Date.now() })
}

/** Token that always fails verification */
const invalidVerifyToken = async (_token: string) => null

/** Records sent emails */
function makeSendMail() {
  const sent: Array<{ to: string; subject: string }> = []
  const fn = async (opts: { to: string; subject: string; html: string; text: string; from: string; apiKey: string }) => {
    sent.push({ to: opts.to, subject: opts.subject })
    return { id: 'email-id-001' }
  }
  return { fn, sent }
}

const VALID_TOKEN = 'valid-token-abc123'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('block-sale-stand-confirm: confirms pending stand and notifies organizer', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ stand: makeStand('pending'), organizerEmail: 'org@example.com' })

  const result = await handleBlockSaleStandConfirm({
    admin,
    origin: 'https://fyndstigen.se',
    input: { token: VALID_TOKEN },
    resendApiKey: 'test-key',
    verifyToken: makeVerifyToken(STAND_ID),
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.standId, STAND_ID)
  assertEquals(sent.length, 1)
  assertEquals(sent[0].to, 'org@example.com')
  assertEquals(sent[0].subject.includes(BLOCK_SALE_NAME), true)
})

Deno.test('block-sale-stand-confirm: idempotent when already confirmed', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ stand: makeStand('confirmed') })

  const result = await handleBlockSaleStandConfirm({
    admin,
    origin: 'https://fyndstigen.se',
    input: { token: VALID_TOKEN },
    resendApiKey: 'test-key',
    verifyToken: makeVerifyToken(STAND_ID),
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.standId, STAND_ID)
  // No email on idempotent re-confirm
  assertEquals(sent.length, 0)
})

Deno.test('block-sale-stand-confirm: idempotent when already approved', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ stand: makeStand('approved') })

  const result = await handleBlockSaleStandConfirm({
    admin,
    origin: 'https://fyndstigen.se',
    input: { token: VALID_TOKEN },
    resendApiKey: 'test-key',
    verifyToken: makeVerifyToken(STAND_ID),
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(sent.length, 0)
})

Deno.test('block-sale-stand-confirm: throws 400 invalid_token when token fails verification', async () => {
  const admin = fakeAdmin()

  const err = await assertRejects(
    () =>
      handleBlockSaleStandConfirm({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: 'bad-token' },
        resendApiKey: 'test-key',
        verifyToken: invalidVerifyToken,
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'invalid_token',
  ) as HttpError
  assertEquals(err.statusCode, 400)
})

Deno.test('block-sale-stand-confirm: throws 400 rejected when stand is rejected', async () => {
  const admin = fakeAdmin({ stand: makeStand('rejected') })

  const err = await assertRejects(
    () =>
      handleBlockSaleStandConfirm({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: VALID_TOKEN },
        resendApiKey: 'test-key',
        verifyToken: makeVerifyToken(STAND_ID),
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'rejected',
  ) as HttpError
  assertEquals(err.statusCode, 400)
})

Deno.test('block-sale-stand-confirm: throws 404 when stand not found', async () => {
  const admin = fakeAdmin({ stand: null })

  const err = await assertRejects(
    () =>
      handleBlockSaleStandConfirm({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: VALID_TOKEN },
        resendApiKey: 'test-key',
        verifyToken: makeVerifyToken(STAND_ID),
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})
