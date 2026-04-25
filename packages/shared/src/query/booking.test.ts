import { describe, it, expect } from 'vitest'
import { BookingQuery } from './booking'

describe('BookingQuery.core.select', () => {
  it('lists scalar columns without joins', () => {
    const s = BookingQuery.core.select
    expect(s).toContain('id')
    expect(s).toContain('status')
    expect(s).toContain('stripe_payment_intent_id')
    expect(s).toContain('flea_market_id')
    expect(s).toContain('payment_status')
    expect(s).toContain('expires_at')
    expect(s).not.toContain('market_tables')
    expect(s).not.toContain('flea_markets')
    expect(s).not.toContain('profiles')
  })
})

describe('BookingQuery.withMarketAndTable.select', () => {
  it('joins market_tables + flea_markets, no profiles', () => {
    const s = BookingQuery.withMarketAndTable.select
    expect(s).toContain('market_tables (label, description, size_description)')
    expect(s).toContain('flea_markets (name, city)')
    expect(s).not.toContain('profiles')
  })
})

describe('BookingQuery.withTableAndProfile.select', () => {
  it('joins market_tables + profiles via booked_by FK, no flea_markets', () => {
    const s = BookingQuery.withTableAndProfile.select
    expect(s).toContain('market_tables (label, description, size_description)')
    expect(s).toContain('profiles!bookings_booked_by_fkey (first_name, last_name)')
    expect(s).not.toContain('flea_markets')
  })
})

describe('BookingQuery.*.mapRow', () => {
  it('withMarketAndTable maps booking + market + table joins to BookingView', () => {
    const v = BookingQuery.withMarketAndTable.mapRow({
      id: 'b-1',
      status: 'pending',
      stripe_payment_intent_id: null,
      flea_market_id: 'fm-1',
      booked_by: 'u-1',
      market_table_id: 't-1',
      booking_date: '2026-06-01',
      price_sek: 100,
      commission_sek: 12,
      commission_rate: 0.12,
      message: null,
      organizer_note: null,
      payment_status: null,
      expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
      market_tables: { label: 'A1', description: 'Hörn', size_description: '2x1m' },
      flea_markets: { name: 'Söder', city: 'Stockholm' },
    })
    expect(v.id).toBe('b-1')
    expect(v.market?.name).toBe('Söder')
    expect(v.table?.label).toBe('A1')
    expect(v.booker).toBeNull()
  })

  it('withTableAndProfile maps profile join into booker, market remains null', () => {
    const v = BookingQuery.withTableAndProfile.mapRow({
      id: 'b-2',
      status: 'confirmed',
      stripe_payment_intent_id: null,
      flea_market_id: 'fm-1',
      booked_by: 'u-1',
      market_table_id: 't-1',
      booking_date: '2026-06-01',
      price_sek: 100,
      commission_sek: 12,
      commission_rate: 0.12,
      message: null,
      organizer_note: null,
      payment_status: 'free',
      expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
      market_tables: { label: 'A1', description: null, size_description: null },
      profiles: { first_name: 'Anna', last_name: 'Svensson' },
    })
    expect(v.booker?.firstName).toBe('Anna')
    expect(v.booker?.lastName).toBe('Svensson')
    expect(v.market).toBeNull()
  })
})
