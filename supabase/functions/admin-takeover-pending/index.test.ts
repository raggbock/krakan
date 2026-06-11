import { assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { handleTakeoverPending } from './index.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const M1 = '00000000-0000-0000-0000-000000000001'
const M2 = '00000000-0000-0000-0000-000000000002'

function tokenRow(
  marketId: string,
  priority: number,
  sentAt: string | null,
  market: { name: string; city?: string | null; contact_email?: string | null },
) {
  return {
    flea_market_id: marketId,
    priority,
    sent_at: sentAt,
    flea_markets: {
      name: market.name,
      city: market.city ?? null,
      contact_email: market.contact_email ?? null,
    },
  }
}

/**
 * Fake SupabaseClient for the single-query shape: a chainable, thenable
 * builder that resolves with `result` when awaited. Records every
 * `.from(table)` call and the `select` string so tests can assert the
 * handler stays on ONE request — a second query with `.in('id', [...])`
 * is the regression this guards against (each id lands in the request
 * URL; ~370 ids ≈ 15 kB which the edge runtime's HTTP/2 client rejects).
 */
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const calls: { tables: string[]; selects: string[] } = { tables: [], selects: [] }
  const builder = {
    select: (cols: string) => {
      calls.selects.push(cols)
      return builder
    },
    eq: (..._a: unknown[]) => builder,
    is: (..._a: unknown[]) => builder,
    gt: (..._a: unknown[]) => builder,
    // deno-lint-ignore no-explicit-any
    then: (resolve: (v: unknown) => any) => Promise.resolve(result).then(resolve),
  }
  const admin = {
    from: (table: string) => {
      calls.tables.push(table)
      return builder
    },
  } as never
  return { admin, calls }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('admin-takeover-pending: returns empty list when no active tokens', async () => {
  const { admin } = fakeAdmin({ data: [], error: null })
  const result = await handleTakeoverPending({ admin })
  assertEquals(result, { markets: [] })
})

Deno.test('admin-takeover-pending: maps embedded market data', async () => {
  const { admin } = fakeAdmin({
    data: [
      tokenRow(M1, 1, '2026-06-01T00:00:00Z', {
        name: 'Stortorgets Loppis',
        city: 'Stockholm',
        contact_email: 'info@example.com',
      }),
    ],
    error: null,
  })
  const result = await handleTakeoverPending({ admin })
  assertEquals(result.markets, [{
    marketId: M1,
    name: 'Stortorgets Loppis',
    city: 'Stockholm',
    contactEmail: 'info@example.com',
    priority: 1,
    sentAt: '2026-06-01T00:00:00Z',
  }])
})

Deno.test('admin-takeover-pending: dedupes per market, keeping lowest priority value', async () => {
  const { admin } = fakeAdmin({
    data: [
      tokenRow(M1, 2, null, { name: 'A' }),
      tokenRow(M1, 1, null, { name: 'A' }),
      tokenRow(M2, 3, null, { name: 'B' }),
    ],
    error: null,
  })
  const result = await handleTakeoverPending({ admin })
  assertEquals(result.markets.length, 2)
  const m1 = result.markets.find((m) => m.marketId === M1)!
  assertEquals(m1.priority, 1)
})

Deno.test('admin-takeover-pending: breaks priority ties by most recent sent_at, nulls last', async () => {
  const { admin } = fakeAdmin({
    data: [
      tokenRow(M1, 1, null, { name: 'A' }),
      tokenRow(M1, 1, '2026-05-01T00:00:00Z', { name: 'A' }),
      tokenRow(M1, 1, '2026-06-01T00:00:00Z', { name: 'A' }),
    ],
    error: null,
  })
  const result = await handleTakeoverPending({ admin })
  assertEquals(result.markets.length, 1)
  assertEquals(result.markets[0].sentAt, '2026-06-01T00:00:00Z')
})

Deno.test('admin-takeover-pending: single request with inner-joined market — never a second id-list query', async () => {
  const { admin, calls } = fakeAdmin({
    data: [tokenRow(M1, 1, null, { name: 'A' })],
    error: null,
  })
  await handleTakeoverPending({ admin })
  assertEquals(calls.tables, ['business_owner_tokens'])
  assertStringIncludes(calls.selects[0], 'flea_markets!inner(')
})

Deno.test('admin-takeover-pending: throws on query error', async () => {
  const { admin } = fakeAdmin({ data: null, error: { message: 'boom' } })
  await assertRejects(() => handleTakeoverPending({ admin }), Error, 'boom')
})
