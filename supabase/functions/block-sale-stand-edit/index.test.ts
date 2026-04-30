import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleBlockSaleStandEdit } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAND_ID = '00000000-0000-0000-0000-000000000001'
const VALID_TOKEN = 'valid-token-abc123xyz'

/** Token that verifies as the given standId */
function makeVerifyToken(standId: string) {
  return async (_token: string) => ({ standId, iat: Date.now() })
}

/** Token that always fails verification */
const invalidVerifyToken = async (_token: string) => null

function makeStand(status: string) {
  return {
    id: STAND_ID,
    status,
    city: 'Stockholm',
  }
}

type FakeAdminOpts = {
  stand?: ReturnType<typeof makeStand> | null
  updateError?: { message: string } | null
}

function fakeAdmin({
  stand = makeStand('confirmed'),
  updateError = null,
}: FakeAdminOpts = {}) {
  return {
    from: (table: string) => {
      if (table === 'block_sale_stands') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              maybeSingle: () => Promise.resolve({ data: stand, error: null }),
            }),
          }),
          update: (_data: unknown) => ({
            eq: (_col: string, _val: unknown) =>
              Promise.resolve({ data: null, error: updateError }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      }
    },
  } as never
}

/** Stub geocoder that returns a fixed coordinate and records calls */
function makeGeocode() {
  const calls: string[] = []
  const fn = async (address: string) => {
    calls.push(address)
    return { lat: 59.3293, lng: 18.0686 }
  }
  return { fn, calls }
}

/** Geocoder that always throws */
const failingGeocode = async (_addr: string): Promise<{ lat: number; lng: number }> => {
  throw new Error('geocode_failed')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('block-sale-stand-edit: edits description successfully', async () => {
  const admin = fakeAdmin({ stand: makeStand('confirmed') })
  const { fn: geocode, calls } = makeGeocode()

  const result = await handleBlockSaleStandEdit({
    admin,
    input: { token: VALID_TOKEN, description: 'Böcker, leksaker och kläder' },
    verifyToken: makeVerifyToken(STAND_ID),
    geocode,
  })

  assertEquals(result.ok, true)
  // No geocoding needed when only description changed
  assertEquals(calls.length, 0)
})

Deno.test('block-sale-stand-edit: re-geocodes when street changes', async () => {
  const admin = fakeAdmin({ stand: makeStand('confirmed') })
  const { fn: geocode, calls } = makeGeocode()

  const result = await handleBlockSaleStandEdit({
    admin,
    input: { token: VALID_TOKEN, street: 'Folkungagatan 42' },
    verifyToken: makeVerifyToken(STAND_ID),
    geocode,
  })

  assertEquals(result.ok, true)
  assertEquals(calls.length, 1)
  assertEquals(calls[0].includes('Folkungagatan 42'), true)
  assertEquals(calls[0].includes('Stockholm'), true)
  assertEquals(calls[0].includes('Sweden'), true)
})

Deno.test('block-sale-stand-edit: geocode failure is swallowed (no location patch)', async () => {
  const admin = fakeAdmin({ stand: makeStand('confirmed') })

  // Should not throw even though geocode fails
  const result = await handleBlockSaleStandEdit({
    admin,
    input: { token: VALID_TOKEN, street: 'Okänd gata 1' },
    verifyToken: makeVerifyToken(STAND_ID),
    geocode: failingGeocode,
  })

  assertEquals(result.ok, true)
})

Deno.test('block-sale-stand-edit: throws 403 when stand is rejected', async () => {
  const admin = fakeAdmin({ stand: makeStand('rejected') })

  const err = await assertRejects(
    () =>
      handleBlockSaleStandEdit({
        admin,
        input: { token: VALID_TOKEN, description: 'Ny beskrivning' },
        verifyToken: makeVerifyToken(STAND_ID),
        geocode: failingGeocode,
      }),
    HttpError,
    'forbidden',
  ) as HttpError
  assertEquals(err.statusCode, 403)
})

Deno.test('block-sale-stand-edit: throws 400 when token is invalid', async () => {
  const admin = fakeAdmin()

  const err = await assertRejects(
    () =>
      handleBlockSaleStandEdit({
        admin,
        input: { token: 'bad-token-xyz', description: 'Ny beskrivning' },
        verifyToken: invalidVerifyToken,
        geocode: failingGeocode,
      }),
    HttpError,
    'invalid_token',
  ) as HttpError
  assertEquals(err.statusCode, 400)
})

Deno.test('block-sale-stand-edit: throws 404 when stand not found', async () => {
  const admin = fakeAdmin({ stand: null })

  const err = await assertRejects(
    () =>
      handleBlockSaleStandEdit({
        admin,
        input: { token: VALID_TOKEN, description: 'Test' },
        verifyToken: makeVerifyToken(STAND_ID),
        geocode: failingGeocode,
      }),
    HttpError,
    'not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('block-sale-stand-edit: no-op when no fields provided', async () => {
  const admin = fakeAdmin({ stand: makeStand('pending') })
  const { fn: geocode, calls } = makeGeocode()

  // token is required but no description/street — patch is empty
  const result = await handleBlockSaleStandEdit({
    admin,
    input: { token: VALID_TOKEN },
    verifyToken: makeVerifyToken(STAND_ID),
    geocode,
  })

  assertEquals(result.ok, true)
  assertEquals(calls.length, 0)
})
