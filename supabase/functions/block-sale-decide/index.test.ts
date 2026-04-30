import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleBlockSaleDecide } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BLOCK_SALE_ID = '00000000-0000-0000-0000-000000000010'
const ORGANIZER_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000099'
const STAND_ID_1 = '00000000-0000-0000-0000-000000000011'
const STAND_ID_2 = '00000000-0000-0000-0000-000000000012'
const BLOCK_SALE_SLUG = 'regnbagsgatan-kvartersloppis-2025'
const BLOCK_SALE_NAME = 'Regnbågsgatan Kvartersloppis'

/**
 * Minimal fluent query builder.
 */
function makeFluentBuilder(result: { data: unknown; error: unknown }) {
  const terminal = () => Promise.resolve(result)
  type Builder = Record<string, (...args: unknown[]) => Builder | Promise<unknown>>
  function make(): Builder {
    return {
      select: () => make(),
      eq: () => make(),
      in: () => make(),
      update: () => make(),
      maybeSingle: terminal,
      single: terminal,
    }
  }
  return make()
}

function makeStand(id: string, status: string) {
  return {
    id,
    status,
    applicant_email: `applicant-${id}@example.com`,
    applicant_name: 'Anna Svensson',
    edit_token: `edit-token-${id}`,
  }
}

type FakeAdminOpts = {
  blockSale?: { id: string; name: string; slug: string; organizer_id: string } | null
  stands?: ReturnType<typeof makeStand>[]
  updateError?: { message: string } | null
}

function fakeAdmin({
  blockSale = {
    id: BLOCK_SALE_ID,
    name: BLOCK_SALE_NAME,
    slug: BLOCK_SALE_SLUG,
    organizer_id: ORGANIZER_ID,
  },
  stands = [makeStand(STAND_ID_1, 'confirmed')],
  updateError = null,
}: FakeAdminOpts = {}) {
  return {
    from: (table: string) => {
      if (table === 'block_sales') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              maybeSingle: () => Promise.resolve({ data: blockSale, error: null }),
            }),
          }),
        }
      }
      if (table === 'block_sale_stands') {
        return {
          select: (_cols: string) => ({
            in: (_col: string, _ids: unknown[]) => ({
              eq: (_col: string, _val: unknown) =>
                Promise.resolve({ data: stands, error: null }),
            }),
          }),
          update: (_data: unknown) => ({
            eq: (_col: string, _val: unknown) =>
              Promise.resolve({ data: null, error: updateError }),
          }),
        }
      }
      return makeFluentBuilder({ data: null, error: { message: `unknown table: ${table}` } })
    },
  } as never
}

/** Records sent emails */
function makeSendMail() {
  const sent: Array<{ to: string; subject: string }> = []
  const fn = async (opts: { to: string; subject: string; html: string; text: string; from: string; apiKey: string }) => {
    sent.push({ to: opts.to, subject: opts.subject })
    return { id: 'email-id-001' }
  }
  return { fn, sent }
}

const VALID_APPROVE_INPUT = {
  blockSaleId: BLOCK_SALE_ID,
  standIds: [STAND_ID_1],
  decision: 'approve' as const,
}

const VALID_REJECT_INPUT = {
  blockSaleId: BLOCK_SALE_ID,
  standIds: [STAND_ID_1],
  decision: 'reject' as const,
  reason: 'Tyvärr är alla platser fyllda.',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('block-sale-decide: approves confirmed stands and sends emails', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ stands: [makeStand(STAND_ID_1, 'confirmed')] })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: VALID_APPROVE_INPUT,
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 1)
  assertEquals(sent.length, 1)
  assertEquals(sent[0].to, `applicant-${STAND_ID_1}@example.com`)
  assertEquals(sent[0].subject.includes(BLOCK_SALE_NAME), true)
})

Deno.test('block-sale-decide: rejects confirmed stands and sends emails', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ stands: [makeStand(STAND_ID_1, 'confirmed')] })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: VALID_REJECT_INPUT,
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 1)
  assertEquals(sent.length, 1)
  assertEquals(sent[0].subject.includes(BLOCK_SALE_NAME), true)
})

Deno.test('block-sale-decide: throws 403 for non-organizer', async () => {
  const admin = fakeAdmin()

  const err = await assertRejects(
    () =>
      handleBlockSaleDecide({
        admin,
        userId: OTHER_USER_ID,
        origin: 'https://fyndstigen.se',
        input: VALID_APPROVE_INPUT,
        resendApiKey: 'test-key',
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'forbidden',
  ) as HttpError
  assertEquals(err.statusCode, 403)
})

Deno.test('block-sale-decide: throws 404 when block_sale not found', async () => {
  const admin = fakeAdmin({ blockSale: null })

  const err = await assertRejects(
    () =>
      handleBlockSaleDecide({
        admin,
        userId: ORGANIZER_ID,
        origin: 'https://fyndstigen.se',
        input: VALID_APPROVE_INPUT,
        resendApiKey: 'test-key',
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('block-sale-decide: skips pending stands (decided count = 0)', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  // pending → approved is not a valid transition
  const admin = fakeAdmin({ stands: [makeStand(STAND_ID_1, 'pending')] })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: VALID_APPROVE_INPUT,
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 0)
  assertEquals(sent.length, 0)
})

Deno.test('block-sale-decide: skips already-approved stands (idempotent, decided count = 0)', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  // approved → approved is not a valid transition
  const admin = fakeAdmin({ stands: [makeStand(STAND_ID_1, 'approved')] })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: VALID_APPROVE_INPUT,
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 0)
  assertEquals(sent.length, 0)
})

Deno.test('block-sale-decide: processes multiple stands, counts only valid transitions', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({
    stands: [
      makeStand(STAND_ID_1, 'confirmed'),
      makeStand(STAND_ID_2, 'pending'), // will be skipped
    ],
  })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: {
      blockSaleId: BLOCK_SALE_ID,
      standIds: [STAND_ID_1, STAND_ID_2],
      decision: 'approve' as const,
    },
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 1)
  assertEquals(sent.length, 1)
})
