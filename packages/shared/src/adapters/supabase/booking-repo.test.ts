import { describe, it, expect } from 'vitest'
import { createSupabaseBookingRepo } from './booking-repo'
import type { Booking } from '../../types'

// Minimal fake of the chainable Supabase query builder.
function makeFakeClient(opts: {
  // Response to return from the UPDATE round-trip. `null` means "0 rows
  // matched" — simulates losing the concurrency race.
  updateResult: { data: unknown; error: unknown }
  // Response for the refetch after a lost update.
  refetchResult?: { data: unknown; error: unknown }
}) {
  const updateFilters: Array<{ field: string; value: unknown }> = []
  // Ordered across the whole test: first `.single()` is the initial SELECT,
  // second is the post-lost-update refetch.
  let selectSingleCalls = 0

  const client = {
    from(_table: string) {
      let mode: 'select' | 'update' = 'select'

      const builder: Record<string, (...args: unknown[]) => unknown> = {
        select() {
          return builder
        },
        update() {
          mode = 'update'
          return builder
        },
        eq(field: string, value: unknown) {
          if (mode === 'update') updateFilters.push({ field, value })
          return builder
        },
        single() {
          if (mode === 'select') {
            selectSingleCalls++
            if (selectSingleCalls === 1) {
              return Promise.resolve({ data: seedRow(), error: null })
            }
            return Promise.resolve(opts.refetchResult ?? { data: seedRow(), error: null })
          }
          return Promise.resolve(opts.updateResult)
        },
        maybeSingle() {
          return Promise.resolve(opts.updateResult)
        },
      }

      return builder
    },
  }

  return { client, updateFilters }
}

// Fake client that returns a row with a flea_markets join (for findByPaymentIntent tests)
function makeFindByPIClient(opts: {
  data: unknown
  error?: unknown
}) {
  const client = {
    from(_table: string) {
      const builder: Record<string, (...args: unknown[]) => unknown> = {
        select() { return builder },
        eq() { return builder },
        single() {
          return Promise.resolve({ data: opts.data, error: opts.error ?? null })
        },
        maybeSingle() {
          return Promise.resolve({ data: opts.data, error: opts.error ?? null })
        },
      }
      return builder
    },
  }
  return client
}

function seedRow(): Booking & { created_at: string } {
  return {
    id: 'b1',
    status: 'pending',
    stripe_payment_intent_id: 'pi_1',
    flea_market_id: 'm1',
    booked_by: 'u1',
    market_table_id: 't1',
    booking_date: '2026-05-01',
    price_sek: 200,
    commission_sek: 24,
    commission_rate: 0.12,
    message: null,
    organizer_note: null,
    payment_status: 'requires_capture',
    expires_at: null,
    created_at: '2026-04-22T00:00:00Z',
  }
}

describe('SupabaseBookingRepo.findByPaymentIntent', () => {
  it('returns { booking, autoAccept: true } when market has auto_accept_bookings=true', async () => {
    const rowWithJoin = { ...seedRow(), flea_markets: { auto_accept_bookings: true } }
    const client = makeFindByPIClient({ data: rowWithJoin })
    const repo = createSupabaseBookingRepo(client as never)
    const result = await repo.findByPaymentIntent('pi_1')
    expect(result).not.toBeNull()
    expect(result?.booking.id).toBe('b1')
    expect(result?.autoAccept).toBe(true)
  })

  it('returns autoAccept: false when market has auto_accept_bookings=false', async () => {
    const rowWithJoin = { ...seedRow(), flea_markets: { auto_accept_bookings: false } }
    const client = makeFindByPIClient({ data: rowWithJoin })
    const repo = createSupabaseBookingRepo(client as never)
    const result = await repo.findByPaymentIntent('pi_1')
    expect(result?.autoAccept).toBe(false)
  })

  it('returns null when no booking found', async () => {
    const client = makeFindByPIClient({ data: null, error: { message: 'not found' } })
    const repo = createSupabaseBookingRepo(client as never)
    const result = await repo.findByPaymentIntent('pi_unknown')
    expect(result).toBeNull()
  })
})

describe('SupabaseBookingRepo.applyEvent concurrency guard', () => {
  it('includes optimistic status filter on UPDATE', async () => {
    const { client, updateFilters } = makeFakeClient({
      updateResult: { data: { ...seedRow(), status: 'confirmed', payment_status: 'captured' }, error: null },
    })

    const repo = createSupabaseBookingRepo(client as never)
    await repo.applyEvent('b1', { type: 'organizer.approve' })

    const statusGuard = updateFilters.find((f) => f.field === 'status')
    expect(statusGuard).toBeDefined()
    expect(statusGuard?.value).toBe('pending')
  })

  it('re-fetches and returns current row when UPDATE loses the race (0 rows matched)', async () => {
    const raceWinner = { ...seedRow(), status: 'cancelled' as const, payment_status: 'cancelled' as const }
    const { client } = makeFakeClient({
      updateResult: { data: null, error: null },
      refetchResult: { data: raceWinner, error: null },
    })

    const repo = createSupabaseBookingRepo(client as never)
    const result = await repo.applyEvent('b1', { type: 'organizer.approve' })

    expect(result.status).toBe('cancelled')
    expect(result.payment_status).toBe('cancelled')
  })

  it('throws when UPDATE returns an error', async () => {
    const { client } = makeFakeClient({
      updateResult: { data: null, error: { message: 'db down' } },
    })

    const repo = createSupabaseBookingRepo(client as never)
    await expect(repo.applyEvent('b1', { type: 'organizer.approve' })).rejects.toThrow(/Failed to update booking/)
  })
})
