import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleBlockSaleStandApply } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BLOCK_SALE_ID = '00000000-0000-0000-0000-000000000010'
const ORGANIZER_ID = '00000000-0000-0000-0000-000000000002'
const USER_ID = '00000000-0000-0000-0000-000000000003'

const PUBLISHED_BLOCK_SALE = {
  id: BLOCK_SALE_ID,
  slug: 'regnbagsgatan-kvartersloppis-2025',
  organizer_id: ORGANIZER_ID,
  name: 'Regnbågsgatan Kvartersloppis',
  end_date: '2025-09-01',
  published_at: '2025-08-01T00:00:00.000Z',
}

const VALID_INPUT = {
  blockSaleId: BLOCK_SALE_ID,
  email: 'anna@example.com',
  name: 'Anna Svensson',
  street: 'Regnbågsgatan 5',
  zipCode: '41266',
  city: 'Göteborg',
  description: 'Barnkläder och leksaker',
  website: '',
}

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
      insert: () => make(),
      maybeSingle: terminal,
      single: terminal,
    }
  }
  return make()
}

function fakeAdmin({
  blockSale = PUBLISHED_BLOCK_SALE as typeof PUBLISHED_BLOCK_SALE | null,
  insertError = null as { message: string } | null,
  organizerEmail = 'organizer@example.com' as string | null,
} = {}) {
  return {
    from: (table: string) => {
      if (table === 'block_sales') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: blockSale, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'block_sale_stands') {
        return {
          insert: (_row: unknown) => Promise.resolve({ data: null, error: insertError }),
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

/** No-op geocoder that always throws (returns null via catch in handler) */
const noopGeocode = async (_addr: string): Promise<{ lat: number; lng: number }> => {
  throw new Error('geocode_not_called')
}

/** Geocoder that returns fixed Stockholm coordinates */
const stubGeocode = async (_addr: string): Promise<{ lat: number; lng: number }> => ({
  lat: 57.7089,
  lng: 11.9746,
})

/** Fixed sign function that returns a predictable token */
const stubSign = async (_payload: { standId: string }) => 'signed-token-abc123'

/** Records sent emails */
function makeSendMail() {
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = []
  const fn = async (opts: { to: string; subject: string; html: string; text: string; from: string; apiKey: string }) => {
    sent.push({ to: opts.to, subject: opts.subject, html: opts.html, text: opts.text })
    return { id: 'email-id-001' }
  }
  return { fn, sent }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('block-sale-stand-apply: inserts pending stand and sends confirm email (anonymous)', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin()

  const result = await handleBlockSaleStandApply({
    admin,
    user: null,
    origin: 'https://fyndstigen.se',
    input: VALID_INPUT,
    resendApiKey: 'test-key',
    geocode: noopGeocode,
    sign: stubSign,
    sendMail,
  })

  assertEquals(result.ok, true)
  assertEquals(typeof result.standId, 'string')
  // Exactly one email: the confirm email to the applicant
  assertEquals(sent.length, 1)
  assertEquals(sent[0].to, 'anna@example.com')
  // Confirm email subject should mention the event name
  assertEquals(sent[0].subject.includes('Regnbågsgatan Kvartersloppis'), true)
  // Email body should contain confirm URL with token
  assertEquals(sent[0].html.includes('signed-token-abc123'), true)
})

Deno.test('block-sale-stand-apply: inserts confirmed stand and notifies organizer (logged in)', async () => {
  const { fn: sendMail, sent } = makeSendMail()
  const admin = fakeAdmin({ organizerEmail: 'org@market.se' })

  const result = await handleBlockSaleStandApply({
    admin,
    user: { id: USER_ID, email: 'anna@example.com' } as never,
    origin: 'https://fyndstigen.se',
    input: VALID_INPUT,
    resendApiKey: 'test-key',
    geocode: noopGeocode,
    sign: stubSign,
    sendMail,
  })

  assertEquals(result.ok, true)
  // Exactly one email: notification to organizer (no confirm step)
  assertEquals(sent.length, 1)
  assertEquals(sent[0].to, 'org@market.se')
  assertEquals(sent[0].subject.includes('Regnbågsgatan Kvartersloppis'), true)
})

Deno.test('block-sale-stand-apply: throws 400 honeypot when website is filled', async () => {
  const admin = fakeAdmin()

  const err = await assertRejects(
    () =>
      handleBlockSaleStandApply({
        admin,
        user: null,
        origin: 'https://fyndstigen.se',
        input: { ...VALID_INPUT, website: 'https://bot.example.com' },
        resendApiKey: 'test-key',
        geocode: noopGeocode,
        sign: stubSign,
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'honeypot',
  ) as HttpError
  assertEquals(err.statusCode, 400)
})

Deno.test('block-sale-stand-apply: throws 404 when block_sale not published', async () => {
  const admin = fakeAdmin({ blockSale: null })

  const err = await assertRejects(
    () =>
      handleBlockSaleStandApply({
        admin,
        user: null,
        origin: 'https://fyndstigen.se',
        input: VALID_INPUT,
        resendApiKey: 'test-key',
        geocode: noopGeocode,
        sign: stubSign,
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('block-sale-stand-apply: throws 404 when block_sale has no published_at', async () => {
  const admin = fakeAdmin({
    blockSale: { ...PUBLISHED_BLOCK_SALE, published_at: null as never },
  })

  const err = await assertRejects(
    () =>
      handleBlockSaleStandApply({
        admin,
        user: null,
        origin: 'https://fyndstigen.se',
        input: VALID_INPUT,
        resendApiKey: 'test-key',
        geocode: noopGeocode,
        sign: stubSign,
        sendMail: async () => ({ id: '' }),
      }),
    HttpError,
    'not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('block-sale-stand-apply: geocodes address when provided', async () => {
  const { fn: sendMail } = makeSendMail()
  const admin = fakeAdmin()
  let geocodedAddress = ''
  const captureGeocode = async (addr: string) => {
    geocodedAddress = addr
    return stubGeocode(addr)
  }

  await handleBlockSaleStandApply({
    admin,
    user: null,
    origin: 'https://fyndstigen.se',
    input: VALID_INPUT,
    resendApiKey: 'test-key',
    geocode: captureGeocode,
    sign: stubSign,
    sendMail,
  })

  assertEquals(geocodedAddress.includes('Regnbågsgatan 5'), true)
  assertEquals(geocodedAddress.includes('Göteborg'), true)
  assertEquals(geocodedAddress.includes('Sweden'), true)
})

Deno.test('block-sale-stand-apply: propagates insert error', async () => {
  const admin = fakeAdmin({ insertError: { message: 'db_error' } })

  await assertRejects(
    () =>
      handleBlockSaleStandApply({
        admin,
        user: null,
        origin: 'https://fyndstigen.se',
        input: VALID_INPUT,
        resendApiKey: 'test-key',
        geocode: noopGeocode,
        sign: stubSign,
        sendMail: async () => ({ id: '' }),
      }),
    Error,
    'db_error',
  )
})
