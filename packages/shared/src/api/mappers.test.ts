import { describe, it, expect } from 'vitest'
import {
  formatName,
  mapBookingViewForUser,
  mapBookingViewForOrganizer,
  mapRouteSummary,
  type BookingRow,
  type RouteSummaryRow,
} from './mappers'
import type { BookingView } from '../types/domain'

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeBookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'b1',
    market_table_id: 'mt1',
    flea_market_id: 'fm1',
    booked_by: 'u1',
    booking_date: '2026-05-01',
    status: 'pending',
    price_sek: 200,
    commission_sek: 24,
    commission_rate: 0.12,
    message: 'Säljer böcker',
    organizer_note: null,
    stripe_payment_intent_id: 'pi_test',
    payment_status: 'requires_capture',
    expires_at: '2026-04-22T12:00:00Z',
    created_at: '2026-04-01T10:00:00Z',
    market_tables: {
      label: 'Bord A',
      description: 'Stort bord vid ingången',
      size_description: '180x60 cm',
    },
    flea_markets: { name: 'Sommarlopppis', city: 'Stockholm' },
    ...overrides,
  } as BookingRow
}

// ---------------------------------------------------------------------------
// formatName
// ---------------------------------------------------------------------------

describe('formatName', () => {
  it('returns full name when both parts present', () => {
    expect(formatName({ first_name: 'Anna', last_name: 'Svensson' })).toBe('Anna Svensson')
  })

  it('returns trimmed name when only first name present', () => {
    expect(formatName({ first_name: 'Anna', last_name: null })).toBe('Anna')
  })

  it('returns empty string for null profile', () => {
    expect(formatName(null)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// mapBookingViewForUser — round-trip tests
// ---------------------------------------------------------------------------

describe('mapBookingViewForUser', () => {
  it('maps core id field', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    expect(view.id).toBe('b1')
  })

  it('maps table sub-object from market_tables join', () => {
    const row = makeBookingRow()
    const view = mapBookingViewForUser(row)
    // table.id comes from market_table_id (the FK), not the joined row's id
    expect(view.table?.id).toBe(row.market_table_id)
    expect(view.table?.label).toBe('Bord A')
    expect(view.table?.description).toBe('Stort bord vid ingången')
    expect(view.table?.sizeDescription).toBe('180x60 cm')
  })

  it('maps market sub-object from flea_markets join', () => {
    const row = makeBookingRow()
    const view = mapBookingViewForUser(row)
    expect(view.market?.id).toBe(row.flea_market_id)
    expect(view.market?.name).toBe('Sommarlopppis')
    expect(view.market?.city).toBe('Stockholm')
  })

  it('sets booker to null (user view does not join profiles)', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    expect(view.booker).toBeNull()
  })

  it('maps date to booking_date', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    expect(view.date).toBe('2026-05-01')
  })

  it('maps price sub-object', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    expect(view.price.baseSek).toBe(200)
    expect(view.price.commissionSek).toBe(24)
    expect(view.price.commissionRate).toBe(0.12)
  })

  it('maps payment sub-object', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    expect(view.payment.status).toBe('requires_capture')
    expect(view.payment.intentId).toBe('pi_test')
    expect(view.payment.expiresAt).toBe('2026-04-22T12:00:00Z')
  })

  it('maps message and organizerNote', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    expect(view.message).toBe('Säljer böcker')
    expect(view.organizerNote).toBeNull()
  })

  it('sets table to null when market_tables join is absent', () => {
    const row = makeBookingRow({ market_tables: null })
    const view = mapBookingViewForUser(row)
    expect(view.table).toBeNull()
  })

  it('sets market to null when flea_markets join is absent', () => {
    const row = makeBookingRow({ flea_markets: null })
    const view = mapBookingViewForUser(row)
    expect(view.market).toBeNull()
  })

  it('does NOT expose raw DB column names on the view', () => {
    const view = mapBookingViewForUser(makeBookingRow()) as unknown as Record<string, unknown>
    // These snake_case FK columns must NOT appear on the domain view
    expect(view).not.toHaveProperty('market_table_id')
    expect(view).not.toHaveProperty('flea_market_id')
    expect(view).not.toHaveProperty('booked_by')
    expect(view).not.toHaveProperty('booking_date')
    expect(view).not.toHaveProperty('price_sek')
    expect(view).not.toHaveProperty('commission_sek')
    expect(view).not.toHaveProperty('commission_rate')
    expect(view).not.toHaveProperty('stripe_payment_intent_id')
    expect(view).not.toHaveProperty('payment_status')
    expect(view).not.toHaveProperty('expires_at')
    expect(view).not.toHaveProperty('organizer_note')
  })
})

// ---------------------------------------------------------------------------
// mapBookingViewForOrganizer — round-trip tests
// ---------------------------------------------------------------------------

describe('mapBookingViewForOrganizer', () => {
  it('maps booker sub-object from profiles join', () => {
    const row = makeBookingRow({
      profiles: { first_name: 'Erik', last_name: 'Nilsson' },
    })
    const view = mapBookingViewForOrganizer(row)
    expect(view.booker?.id).toBe(row.booked_by)
    expect(view.booker?.firstName).toBe('Erik')
    expect(view.booker?.lastName).toBe('Nilsson')
  })

  it('sets market to null (organizer view does not join flea_markets)', () => {
    const row = makeBookingRow({
      profiles: { first_name: 'Erik', last_name: 'Nilsson' },
    })
    const view = mapBookingViewForOrganizer(row)
    expect(view.market).toBeNull()
  })

  it('sets booker to null when profiles join absent', () => {
    const row = makeBookingRow({ profiles: undefined })
    const view = mapBookingViewForOrganizer(row)
    expect(view.booker).toBeNull()
  })

  it('maps table sub-object correctly', () => {
    const row = makeBookingRow({
      profiles: { first_name: 'Erik', last_name: 'Nilsson' },
    })
    const view = mapBookingViewForOrganizer(row)
    expect(view.table?.label).toBe('Bord A')
    expect(view.table?.id).toBe(row.market_table_id)
  })

  it('does NOT expose raw DB column names on the view', () => {
    const row = makeBookingRow({
      profiles: { first_name: 'Erik', last_name: 'Nilsson' },
    })
    const view = mapBookingViewForOrganizer(row) as unknown as Record<string, unknown>
    expect(view).not.toHaveProperty('market_table_id')
    expect(view).not.toHaveProperty('flea_market_id')
    expect(view).not.toHaveProperty('booked_by')
    expect(view).not.toHaveProperty('booking_date')
    expect(view).not.toHaveProperty('stripe_payment_intent_id')
    expect(view).not.toHaveProperty('payment_status')
  })
})

// ---------------------------------------------------------------------------
// mapRouteSummary — existing mapper, quick regression test
// ---------------------------------------------------------------------------

describe('mapRouteSummary', () => {
  it('counts stops from route_stops array', () => {
    const row: RouteSummaryRow = {
      id: 'r1',
      route_stops: [{ id: 'rs1' }, { id: 'rs2' }, { id: 'rs3' }],
    }
    const summary = mapRouteSummary(row)
    expect(summary.stopCount).toBe(3)
  })

  it('handles empty route_stops gracefully', () => {
    const row: RouteSummaryRow = { id: 'r1', route_stops: [] }
    const summary = mapRouteSummary(row)
    expect(summary.stopCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Type-level guard: verify BookingView shape is enforced at compile time
// This test exists solely to catch shape regressions — a compile error here
// means the type contract between mapper output and BookingView has drifted.
// ---------------------------------------------------------------------------

describe('BookingView type contract', () => {
  it('satisfies the BookingView interface', () => {
    const view = mapBookingViewForUser(makeBookingRow())
    // Type assertion — if BookingView changes, this will fail to compile
    const _typed: BookingView = view
    expect(_typed.id).toBeDefined()
  })
})
