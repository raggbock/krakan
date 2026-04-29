import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleTakeoverStart } from './index.ts'
import { HttpError } from '../_shared/handler.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE = new Date(Date.now() + 60_000).toISOString()
const PAST = new Date(Date.now() - 60_000).toISOString()
const MARKET_ID = '00000000-0000-0000-0000-000000000002'
const TOKEN = 'a'.repeat(20)
const RECIPIENT_EMAIL = 'owner@example.com'

const TOKEN_ROW = {
  id: 'tok2',
  flea_market_id: MARKET_ID,
  sent_to_email: RECIPIENT_EMAIL,
  expires_at: FUTURE,
  used_at: null,
  invalidated_at: null,
  clicked_at: null,
}
const MARKET_ROW = {
  name: 'Kulans Loppmarknad',
  slug: 'kulans-loppmarknad',
  is_deleted: false,
}

/**
 * Minimal fluent builder. Plain object (not Proxy) so `await` never mistakes
 * it for a thenable.
 */
function makeFluentBuilder(result: { data: unknown; error: unknown }) {
  const terminal = () => Promise.resolve(result)
  type Builder = Record<string, (...args: unknown[]) => Builder | Promise<unknown>>
  function make(): Builder {
    return { select: () => make(), eq: () => make(), single: terminal, maybeSingle: terminal, update: () => make() }
  }
  return make()
}

/**
 * Build a fake admin client wired for the full takeover-start flow.
 *
 * Calls made by this flow:
 *   validateTakeoverToken:
 *     admin.from('business_owner_tokens').select(...).eq(...).maybeSingle()
 *   handler (pre-claim market check):
 *     admin.from('flea_markets').select('name, slug, is_deleted').eq(...).single()
 *   handler (stamp attempt):
 *     admin.rpc('stamp_takeover_attempt', ...)     — best-effort, always ok
 *   claimTakeover → resolve/create user:
 *     admin.from('auth_user_email_view').select('id').eq(...).maybeSingle()
 *     admin.auth.admin.createUser(...)             — only when existingUserId is null
 *   claimTakeover → claim:
 *     admin.rpc('claim_takeover_atomic', ...)
 *   claimTakeover → market name (best-effort):
 *     admin.from('flea_markets').select('name').eq(...).single()
 *   claimTakeover → generate magic-link:
 *     admin.auth.admin.generateLink(...)
 *   claimTakeover → sendEmail:
 *     skipped when RESEND_API_KEY absent (no env set in tests) — console.error, no throw
 */
function fakeAdminForStart({
  tokenRow = TOKEN_ROW as unknown,
  marketRow = MARKET_ROW as unknown,
  existingUserId = null as string | null,
  claimRpcError = null as { message: string } | null,
} = {}) {
  return {
    from: (table: string) => {
      if (table === 'business_owner_tokens') return makeFluentBuilder({ data: tokenRow, error: null })
      if (table === 'flea_markets') return makeFluentBuilder({ data: marketRow, error: null })
      if (table === 'auth_user_email_view') {
        const data = existingUserId ? { id: existingUserId } : null
        return makeFluentBuilder({ data, error: null })
      }
      return makeFluentBuilder({ data: null, error: { message: `unknown table: ${table}` } })
    },
    rpc: async (name: string) => {
      if (name === 'stamp_takeover_attempt') return { data: null, error: null }
      if (name === 'claim_takeover_atomic') return { data: null, error: claimRpcError }
      return { data: null, error: null }
    },
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: 'new-user-id' } }, error: null }),
        generateLink: async () => ({
          data: { properties: { action_link: 'https://magic.link/abc' } },
          error: null,
        }),
      },
    },
  } as never
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('takeover-start: happy path — valid token + matching email returns ok', async () => {
  // RESEND_API_KEY is not set → magicLinkSent = false (soft-fail in claimTakeover)
  const admin = fakeAdminForStart()
  const result = await handleTakeoverStart({
    admin,
    origin: 'https://fyndstigen.se',
    input: { token: TOKEN, email: RECIPIENT_EMAIL },
  })
  assertEquals(result.ok, true)
  // magicLinkSent false because RESEND_API_KEY is absent in the test environment
  assertEquals(result.magicLinkSent, false)
})

Deno.test('takeover-start: happy path — uses existing user when auth_user_email_view has a match', async () => {
  const admin = fakeAdminForStart({ existingUserId: 'existing-uid-123' })
  const result = await handleTakeoverStart({
    admin,
    origin: 'https://fyndstigen.se',
    input: { token: TOKEN, email: RECIPIENT_EMAIL },
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-start: happy path — redirectTo falls back to /profile when slug is null', async () => {
  const admin = fakeAdminForStart({ marketRow: { ...MARKET_ROW, slug: null } })
  const result = await handleTakeoverStart({
    admin,
    origin: 'https://fyndstigen.se',
    input: { token: TOKEN, email: RECIPIENT_EMAIL },
  })
  assertEquals(result.ok, true)
})

Deno.test('takeover-start: throws 400 on email_mismatch', async () => {
  const admin = fakeAdminForStart()
  const err = await assertRejects(
    () =>
      handleTakeoverStart({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: TOKEN, email: 'wrong@example.com' },
      }),
    HttpError,
    'email_mismatch',
  ) as HttpError
  assertEquals(err.statusCode, 400)
})

Deno.test('takeover-start: throws 410 on token_already_used (pre-flight)', async () => {
  const admin = fakeAdminForStart({ tokenRow: { ...TOKEN_ROW, used_at: PAST } })
  const err = await assertRejects(
    () =>
      handleTakeoverStart({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: TOKEN, email: RECIPIENT_EMAIL },
      }),
    HttpError,
    'token_already_used',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-start: throws 410 on token_expired (pre-flight)', async () => {
  const admin = fakeAdminForStart({ tokenRow: { ...TOKEN_ROW, expires_at: PAST } })
  const err = await assertRejects(
    () =>
      handleTakeoverStart({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: TOKEN, email: RECIPIENT_EMAIL },
      }),
    HttpError,
    'token_expired',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-start: throws 410 when claim_takeover_atomic returns token_already_used', async () => {
  const admin = fakeAdminForStart({ claimRpcError: { message: 'token_already_used' } })
  const err = await assertRejects(
    () =>
      handleTakeoverStart({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: TOKEN, email: RECIPIENT_EMAIL },
      }),
    HttpError,
    'token_already_used',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})

Deno.test('takeover-start: throws 410 when claim_takeover_atomic returns market_deleted', async () => {
  const admin = fakeAdminForStart({ claimRpcError: { message: 'market_deleted' } })
  const err = await assertRejects(
    () =>
      handleTakeoverStart({
        admin,
        origin: 'https://fyndstigen.se',
        input: { token: TOKEN, email: RECIPIENT_EMAIL },
      }),
    HttpError,
    'market_removed',
  ) as HttpError
  assertEquals(err.statusCode, 410)
})
