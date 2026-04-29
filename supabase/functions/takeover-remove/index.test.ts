import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleTakeoverRemove } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE = new Date(Date.now() + 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()
const MARKET_ID = '00000000-0000-0000-0000-000000000004'
const TOKEN = 'a'.repeat(20)

const TOKEN_ROW = {
  id: 'tok4',
  flea_market_id: MARKET_ID,
  sent_to_email: 'owner@example.com',
  expires_at: FUTURE,
  used_at: null,
  invalidated_at: null,
  clicked_at: null,
}
const MARKET_ROW = {
  name: 'Sommarloppis',
  city: 'Malmö',
}

/**
 * Minimal fluent builder. Plain object, NOT a Proxy, so `await builder` never
 * treats it as a thenable.
 */
function makeFluentBuilder(result: { data: unknown; error: unknown }) {
  const terminal = () => Promise.resolve(result)
  type Builder = Record<string, (...args: unknown[]) => Builder | Promise<unknown>>
  function make(): Builder {
    return { select: () => make(), eq: () => make(), single: terminal, maybeSingle: terminal, update: () => make() }
  }
  return make()
}

function fakeAdmin(
  tokenData: unknown,
  marketData: unknown,
  rpcError: { message: string } | null = null,
) {
  return {
    from: (table: string) => {
      if (table === 'business_owner_tokens') return makeFluentBuilder({ data: tokenData, error: null })
      if (table === 'flea_markets') return makeFluentBuilder({ data: marketData, error: null })
      return makeFluentBuilder({ data: null, error: { message: `unknown table: ${table}` } })
    },
    rpc: async () => ({ data: null, error: rpcError }),
  } as never
}

/** Simulates a successful Resend API response. */
function fakeFetch(): typeof fetch {
  return async () => new Response(JSON.stringify({ id: 'email-id-456' }), { status: 200 })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('takeover-remove: happy path — removes market, returns ok (no reason)', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW)
  const result = await handleTakeoverRemove({
    admin,
    input: { token: TOKEN },
    resendApiKey: 'test-key',
    fetchImpl: fakeFetch(),
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-remove: happy path — removes market, returns ok (with reason)', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW)
  const result = await handleTakeoverRemove({
    admin,
    input: { token: TOKEN, reason: 'Business permanently closed' },
    resendApiKey: 'test-key',
    fetchImpl: fakeFetch(),
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-remove: happy path — no notification when RESEND_API_KEY absent', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW)
  const result = await handleTakeoverRemove({
    admin,
    input: { token: TOKEN },
    resendApiKey: undefined,
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-remove: blank reason treated as null (no content stored)', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW)
  const result = await handleTakeoverRemove({
    admin,
    input: { token: TOKEN, reason: '   ' },
    resendApiKey: 'test-key',
    fetchImpl: fakeFetch(),
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-remove: throws 404 on token_not_found (null token row)', async () => {
  const admin = fakeAdmin(null, MARKET_ROW)
  const err = await assertRejects(
    () => handleTakeoverRemove({ admin, input: { token: TOKEN }, resendApiKey: undefined }),
    HttpError,
    'token_not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('takeover-remove: throws 410 on token_expired', async () => {
  const admin = fakeAdmin({ ...TOKEN_ROW, expires_at: PAST }, MARKET_ROW)
  const err = await assertRejects(
    () => handleTakeoverRemove({ admin, input: { token: TOKEN }, resendApiKey: undefined }),
    HttpError,
    'token_expired',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-remove: throws 410 on token_already_used (pre-flight)', async () => {
  const admin = fakeAdmin({ ...TOKEN_ROW, used_at: PAST }, MARKET_ROW)
  const err = await assertRejects(
    () => handleTakeoverRemove({ admin, input: { token: TOKEN }, resendApiKey: undefined }),
    HttpError,
    'token_already_used',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-remove: throws 410 on token_invalidated', async () => {
  const admin = fakeAdmin({ ...TOKEN_ROW, invalidated_at: PAST }, MARKET_ROW)
  const err = await assertRejects(
    () => handleTakeoverRemove({ admin, input: { token: TOKEN }, resendApiKey: undefined }),
    HttpError,
    'token_invalidated',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-remove: throws 410 when remove_via_takeover RPC returns token_already_used', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW, { message: 'token_already_used' })
  const err = await assertRejects(
    () => handleTakeoverRemove({ admin, input: { token: TOKEN }, resendApiKey: undefined }),
    HttpError,
    'token_already_used',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})
