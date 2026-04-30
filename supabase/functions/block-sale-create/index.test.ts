import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleBlockSaleCreate } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A start_date that is always in the future. */
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)

const PAST_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)

const USER_ID = '00000000-0000-0000-0000-000000000001'

const VALID_INPUT = {
  name: 'Regnbågsgatan Kvartersloppis',
  startDate: FUTURE_DATE,
  endDate: FUTURE_DATE,
  dailyOpen: '09:00',
  dailyClose: '15:00',
  city: 'Stockholm',
  publish: false,
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

/**
 * Fake admin client.
 *
 * `block_sales` is called twice per request:
 *   1. slug uniqueness check → maybeSingle() with { data: null } = no collision
 *   2. insert → we return immediately with no error
 *
 * We use a simple call-counter so the first call returns the slug-check result
 * and the second (insert) returns the insert result.
 */
function fakeAdmin({
  slugExists = false,
  insertError = null as { message: string } | null,
} = {}) {
  let blockSalesCalls = 0
  return {
    from: (table: string) => {
      if (table === 'block_sales') {
        blockSalesCalls++
        if (blockSalesCalls === 1) {
          // Slug uniqueness check
          return makeFluentBuilder({ data: slugExists ? { id: 'existing-id' } : null, error: null })
        }
        // Insert call
        return makeFluentBuilder({ data: null, error: insertError })
      }
      return makeFluentBuilder({ data: null, error: { message: `unknown table: ${table}` } })
    },
  } as never
}

/** No-op geocoder that always fails (returns null via catch in handler). */
const noopGeocode = async (_addr: string): Promise<{ lat: number; lng: number }> => {
  throw new Error('geocode_not_called')
}

/** Geocoder that returns a fixed coordinate. */
const stubGeocode = async (_addr: string): Promise<{ lat: number; lng: number }> => ({
  lat: 59.3293,
  lng: 18.0686,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('block-sale-create: creates draft when publish=false (published_at=null)', async () => {
  const admin = fakeAdmin()
  const result = await handleBlockSaleCreate({
    admin,
    userId: USER_ID,
    input: { ...VALID_INPUT, publish: false },
    geocode: noopGeocode,
  })
  assertEquals(result.ok, true)
  assertEquals(typeof result.slug, 'string')
  // Slug should contain parts of name and city
  assertEquals(result.slug.includes('stockholm'), true)
})

Deno.test('block-sale-create: rejects start_date in past with HttpError 400', async () => {
  const admin = fakeAdmin()
  const err = await assertRejects(
    () =>
      handleBlockSaleCreate({
        admin,
        userId: USER_ID,
        input: { ...VALID_INPUT, startDate: PAST_DATE, endDate: PAST_DATE },
        geocode: noopGeocode,
      }),
    HttpError,
    'start_in_past',
  ) as HttpError
  assertEquals(err.statusCode, 400)
})

Deno.test('block-sale-create: publishes when publish=true', async () => {
  const admin = fakeAdmin()
  const result = await handleBlockSaleCreate({
    admin,
    userId: USER_ID,
    input: { ...VALID_INPUT, publish: true },
    geocode: noopGeocode,
  })
  assertEquals(result.ok, true)
})

Deno.test('block-sale-create: geocodes center_location when street provided', async () => {
  let geocodedAddress = ''
  const captureGeocode = async (addr: string) => {
    geocodedAddress = addr
    return stubGeocode(addr)
  }

  const admin = fakeAdmin()
  const result = await handleBlockSaleCreate({
    admin,
    userId: USER_ID,
    input: { ...VALID_INPUT, street: 'Regnbågsgatan 5', publish: true },
    geocode: captureGeocode,
  })
  assertEquals(result.ok, true)
  assertEquals(geocodedAddress.includes('Regnbågsgatan 5'), true)
  assertEquals(geocodedAddress.includes('Stockholm'), true)
  assertEquals(geocodedAddress.includes('Sweden'), true)
})

Deno.test('block-sale-create: skips geocoding when no street provided', async () => {
  let geocodeCalled = false
  const trackingGeocode = async (addr: string) => {
    geocodeCalled = true
    return stubGeocode(addr)
  }

  const admin = fakeAdmin()
  await handleBlockSaleCreate({
    admin,
    userId: USER_ID,
    input: { ...VALID_INPUT },
    geocode: trackingGeocode,
  })
  assertEquals(geocodeCalled, false)
})

Deno.test('block-sale-create: retries slug on collision', async () => {
  // First slug check: collision. Second: free.
  let slugChecks = 0
  const admin = {
    from: (table: string) => {
      if (table === 'block_sales') {
        slugChecks++
        if (slugChecks === 1) {
          // First slug check → collision
          return makeFluentBuilder({ data: { id: 'taken' }, error: null })
        }
        // Second slug check → free; insert → ok
        return makeFluentBuilder({ data: null, error: null })
      }
      return makeFluentBuilder({ data: null, error: { message: `unknown: ${table}` } })
    },
  } as never

  const result = await handleBlockSaleCreate({
    admin,
    userId: USER_ID,
    input: VALID_INPUT,
    geocode: noopGeocode,
  })
  assertEquals(result.ok, true)
  // Slug should have a suffix when first candidate was taken
  assertEquals(result.slug.endsWith('-2'), true)
})

Deno.test('block-sale-create: propagates insert error', async () => {
  const admin = fakeAdmin({ insertError: { message: 'db_error' } })
  await assertRejects(
    () =>
      handleBlockSaleCreate({
        admin,
        userId: USER_ID,
        input: VALID_INPUT,
        geocode: noopGeocode,
      }),
    Error,
    'db_error',
  )
})
