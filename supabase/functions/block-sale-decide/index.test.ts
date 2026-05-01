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

// ---------------------------------------------------------------------------
// New tests: bulk + cross-tenant + email failure resilience
// ---------------------------------------------------------------------------

const STAND_ID_3 = '00000000-0000-0000-0000-000000000013'
const STAND_ID_4 = '00000000-0000-0000-0000-000000000014'
const STAND_ID_5 = '00000000-0000-0000-0000-000000000015'

Deno.test('block-sale-decide: bulk approve 3 confirmed + 2 already-approved → decided=3, 3 emails sent', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({
    stands: [
      makeStand(STAND_ID_1, 'confirmed'),
      makeStand(STAND_ID_2, 'confirmed'),
      makeStand(STAND_ID_3, 'confirmed'),
      makeStand(STAND_ID_4, 'approved'), // already approved — skipped
      makeStand(STAND_ID_5, 'approved'), // already approved — skipped
    ],
  })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: {
      blockSaleId: BLOCK_SALE_ID,
      standIds: [STAND_ID_1, STAND_ID_2, STAND_ID_3, STAND_ID_4, STAND_ID_5],
      decision: 'approve' as const,
    },
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 3)
  assertEquals(sent.length, 3)
})

Deno.test('block-sale-decide: cross-tenant attack returns decided=0 (stands from different block_sale filtered out by .eq)', async () => {
  // In production, the DB query filters by block_sale_id so stands from
  // another block_sale are never returned. We simulate this by returning []
  // from the fake — equivalent to the DB filtering them all out.
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ stands: [] }) // DB filter would remove foreign stands

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: {
      blockSaleId: BLOCK_SALE_ID,
      standIds: [STAND_ID_1, STAND_ID_2], // standIds from a different block_sale
      decision: 'approve' as const,
    },
    resendApiKey: 'test-key',
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(result.decided, 0)
  assertEquals(sent.length, 0)
})

Deno.test('block-sale-decide: email send failure for stand #2 breaks the loop (current behavior — gap documented)', async () => {
  // Email failure for one stand should NOT abandon the bulk operation.
  // The DB transition has already happened — failing the whole request
  // would leave earlier stands updated-but-unnotified AND prevent later
  // stands from being processed. Instead we count failures and surface
  // them so the organizer UI can warn / retry.
  let callCount = 0
  const failOnSecond = async (opts: { to: string; subject: string; html: string; text: string; from: string; apiKey: string }) => {
    callCount++
    if (callCount === 2) throw new Error('SMTP timeout')
    return { id: `email-${callCount}` }
  }

  const admin = fakeAdmin({
    stands: [
      makeStand(STAND_ID_1, 'confirmed'),
      makeStand(STAND_ID_2, 'confirmed'),
      makeStand(STAND_ID_3, 'confirmed'),
    ],
  })

  const result = await handleBlockSaleDecide({
    admin,
    userId: ORGANIZER_ID,
    origin: 'https://fyndstigen.se',
    input: {
      blockSaleId: BLOCK_SALE_ID,
      standIds: [STAND_ID_1, STAND_ID_2, STAND_ID_3],
      decision: 'approve' as const,
    },
    resendApiKey: 'test-key',
    sendMail: failOnSecond,
  })

  // All 3 stands DB-transitioned to approved despite stand #2's email failure.
  assertEquals(result.decided, 3, 'all stands decide regardless of email failures')
  assertEquals(result.emailFailures, 1, 'stand #2 email failed, others succeeded')
  assertEquals(callCount, 3, 'sendMail attempted for all 3 stands')
})
