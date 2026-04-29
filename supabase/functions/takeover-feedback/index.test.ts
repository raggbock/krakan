import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleTakeoverFeedback } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE = new Date(Date.now() + 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()
const MARKET_ID = '00000000-0000-0000-0000-000000000003'
const TOKEN = 'a'.repeat(20)

const TOKEN_ROW = {
  id: 'tok3',
  flea_market_id: MARKET_ID,
  sent_to_email: 'owner@example.com',
  expires_at: FUTURE,
  used_at: null,
  invalidated_at: null,
  clicked_at: null,
}
const MARKET_ROW = {
  name: 'Tullens Loppis',
  city: 'Göteborg',
  is_deleted: false,
}

/**
 * Minimal fluent builder that resolves with `result` at `.single()` or
 * `.maybeSingle()`. Uses a plain object (not Proxy) so `await builder` does
 * not treat the builder itself as a thenable.
 */
function makeFluentBuilder(result: { data: unknown; error: unknown }) {
  const terminal = () => Promise.resolve(result)
  type Builder = Record<string, (...args: unknown[]) => Builder | Promise<unknown>>
  function make(): Builder {
    return { select: () => make(), eq: () => make(), single: terminal, maybeSingle: terminal, update: () => make() }
  }
  return make()
}

function fakeAdmin(tokenData: unknown, marketData: unknown) {
  return {
    from: (table: string) => {
      if (table === 'business_owner_tokens') return makeFluentBuilder({ data: tokenData, error: null })
      if (table === 'flea_markets') return makeFluentBuilder({ data: marketData, error: null })
      return makeFluentBuilder({ data: null, error: { message: `unknown table: ${table}` } })
    },
    rpc: async () => ({ data: null, error: null }),
  } as never
}

/** Simulates a successful Resend API response. */
function fakeFetch(): typeof fetch {
  return async () => new Response(JSON.stringify({ id: 'email-id-123' }), { status: 200 })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('takeover-feedback: happy path — valid token, sends notification email, returns ok', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW)
  const result = await handleTakeoverFeedback({
    admin,
    input: { token: TOKEN, email: 'visitor@example.com', message: 'The address is wrong.' },
    resendApiKey: 'test-key',
    fetchImpl: fakeFetch(),
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-feedback: throws 404 on token_not_found (null token row)', async () => {
  const admin = fakeAdmin(null, MARKET_ROW)
  const err = await assertRejects(
    () =>
      handleTakeoverFeedback({
        admin,
        input: { token: TOKEN, email: 'visitor@example.com', message: 'Test' },
        resendApiKey: 'test-key',
        fetchImpl: fakeFetch(),
      }),
    HttpError,
    'token_not_found',
  ) as HttpError
  assertEquals(err.statusCode, 404)
})

Deno.test('takeover-feedback: throws 410 on token_expired', async () => {
  const admin = fakeAdmin({ ...TOKEN_ROW, expires_at: PAST }, MARKET_ROW)
  const err = await assertRejects(
    () =>
      handleTakeoverFeedback({
        admin,
        input: { token: TOKEN, email: 'visitor@example.com', message: 'Test' },
        resendApiKey: 'test-key',
        fetchImpl: fakeFetch(),
      }),
    HttpError,
    'token_expired',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-feedback: throws 410 on token_already_used', async () => {
  const admin = fakeAdmin({ ...TOKEN_ROW, used_at: PAST }, MARKET_ROW)
  const err = await assertRejects(
    () =>
      handleTakeoverFeedback({
        admin,
        input: { token: TOKEN, email: 'visitor@example.com', message: 'Test' },
        resendApiKey: 'test-key',
        fetchImpl: fakeFetch(),
      }),
    HttpError,
    'token_already_used',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-feedback: throws 410 on token_invalidated', async () => {
  const admin = fakeAdmin({ ...TOKEN_ROW, invalidated_at: PAST }, MARKET_ROW)
  const err = await assertRejects(
    () =>
      handleTakeoverFeedback({
        admin,
        input: { token: TOKEN, email: 'visitor@example.com', message: 'Test' },
        resendApiKey: 'test-key',
        fetchImpl: fakeFetch(),
      }),
    HttpError,
    'token_invalidated',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-feedback: throws 500 when RESEND_API_KEY is missing', async () => {
  const admin = fakeAdmin(TOKEN_ROW, MARKET_ROW)
  const err = await assertRejects(
    () =>
      handleTakeoverFeedback({
        admin,
        input: { token: TOKEN, email: 'visitor@example.com', message: 'Test' },
        resendApiKey: undefined,
      }),
    HttpError,
    'RESEND_API_KEY missing',
  ) as HttpError
  assertEquals(err.statusCode, 500)
})

Deno.test('takeover-feedback: throws 410 on market_removed (is_deleted = true)', async () => {
  const admin = fakeAdmin(TOKEN_ROW, { ...MARKET_ROW, is_deleted: true })
  const err = await assertRejects(
    () =>
      handleTakeoverFeedback({
        admin,
        input: { token: TOKEN, email: 'visitor@example.com', message: 'Test' },
        resendApiKey: 'test-key',
        fetchImpl: fakeFetch(),
      }),
    HttpError,
    'market_removed',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})
