import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleTakeoverInfo } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE = new Date(Date.now() + 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()
const MARKET_ID = '00000000-0000-0000-0000-000000000001'
const TOKEN = 'a'.repeat(20)

const TOKEN_ROW = {
  id: 'tok1',
  flea_market_id: MARKET_ID,
  sent_to_email: 'info@example.com',
  expires_at: FUTURE,
  used_at: null,
  invalidated_at: null,
  clicked_at: null,
}
const MARKET_ROW = {
  name: 'Stortorgets Loppis',
  city: 'Stockholm',
  region: 'Stockholms län',
  contact_website: 'https://example.com',
  is_deleted: false,
}

/**
 * Build a fluent query builder that always resolves with `result` at any
 * terminal call. Uses an explicit `.then`-less object so `await` does not
 * accidentally treat the builder itself as a thenable.
 *
 * The builder covers the three terminal methods used by the edge functions:
 *   - maybeSingle() — used by validateTakeoverToken
 *   - single()      — used by market lookups
 *   - eq() as the final call after update() — used for click-stamp
 */
function makeFluentBuilder(result: { data: unknown; error: unknown }): Record<string, unknown> {
  // A terminal async method that resolves with `result`.
  const terminal = () => Promise.resolve(result)
  // A best-effort async stub for update+eq (click-stamp — always succeeds).
  const updateTerminal = () => Promise.resolve({ data: null, error: null })

  // Using a plain object (not Proxy) so `await builder` does not misfires on
  // the `.then` property check.
  type Builder = {
    [k: string]: (...args: unknown[]) => Builder | Promise<unknown>
  }

  function makeBuilder(isAfterUpdate = false): Builder {
    return {
      select: (..._a: unknown[]) => makeBuilder(),
      eq: (..._a: unknown[]) => isAfterUpdate ? updateTerminal() : makeBuilder() as unknown as Promise<unknown>,
      maybeSingle: terminal,
      single: terminal,
      update: (..._a: unknown[]) => makeBuilder(true),
    } as unknown as Builder
  }
  return makeBuilder() as Record<string, unknown>
}

/**
 * A minimal fake `SupabaseClient` that routes `.from(table)` to per-table
 * results and routes `.rpc(...)` to a no-op success.
 */
function fakeAdmin(tableMap: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: (table: string) => {
      const result = tableMap[table] ?? { data: null, error: { message: `unknown table: ${table}` } }
      return makeFluentBuilder(result)
    },
    rpc: async () => ({ data: null, error: null }),
  } as never
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('takeover-info: returns market info when token is valid + market exists', async () => {
  const admin = fakeAdmin({
    business_owner_tokens: { data: TOKEN_ROW, error: null },
    flea_markets: { data: MARKET_ROW, error: null },
  })
  const result = await handleTakeoverInfo({ admin, input: { token: TOKEN } })
  assertEquals(result.name, 'Stortorgets Loppis')
  assertEquals(result.city, 'Stockholm')
  assertEquals(result.region, 'Stockholms län')
  assertEquals(result.sourceUrl, 'https://example.com')
  assertEquals(result.maskedEmail, 'i••@example.com')
  assertEquals(result.marketId, MARKET_ID)
})

Deno.test('takeover-info: throws 404 on token_not_found (null token row)', async () => {
  const admin = fakeAdmin({
    business_owner_tokens: { data: null, error: null },
    flea_markets: { data: MARKET_ROW, error: null },
  })
  const err = await assertRejects(
    () => handleTakeoverInfo({ admin, input: { token: TOKEN } }),
    HttpError,
    'token_not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('takeover-info: throws 410 on token_expired', async () => {
  const admin = fakeAdmin({
    business_owner_tokens: { data: { ...TOKEN_ROW, expires_at: PAST }, error: null },
    flea_markets: { data: MARKET_ROW, error: null },
  })
  const err = await assertRejects(
    () => handleTakeoverInfo({ admin, input: { token: TOKEN } }),
    HttpError,
    'token_expired',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-info: throws 410 on token_already_used', async () => {
  const admin = fakeAdmin({
    business_owner_tokens: { data: { ...TOKEN_ROW, used_at: PAST }, error: null },
    flea_markets: { data: MARKET_ROW, error: null },
  })
  const err = await assertRejects(
    () => handleTakeoverInfo({ admin, input: { token: TOKEN } }),
    HttpError,
    'token_already_used',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-info: throws 410 on token_invalidated', async () => {
  const admin = fakeAdmin({
    business_owner_tokens: { data: { ...TOKEN_ROW, invalidated_at: PAST }, error: null },
    flea_markets: { data: MARKET_ROW, error: null },
  })
  const err = await assertRejects(
    () => handleTakeoverInfo({ admin, input: { token: TOKEN } }),
    HttpError,
    'token_invalidated',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-info: throws 410 on market_removed (is_deleted = true)', async () => {
  const admin = fakeAdmin({
    business_owner_tokens: { data: TOKEN_ROW, error: null },
    flea_markets: { data: { ...MARKET_ROW, is_deleted: true }, error: null },
  })
  const err = await assertRejects(
    () => handleTakeoverInfo({ admin, input: { token: TOKEN } }),
    HttpError,
    'market_removed',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})
