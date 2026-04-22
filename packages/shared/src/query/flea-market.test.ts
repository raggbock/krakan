/**
 * Round-trip test: mock Supabase row → FleaMarketQuery.details.mapRow → domain shape.
 *
 * This test verifies that:
 * 1. The select string is stable (regression guard).
 * 2. mapRow produces the expected FleaMarketDetails shape.
 * 3. No Record<string, unknown> casts silently swallow field renames.
 */

import { describe, it, expect } from 'vitest'
import { FleaMarketQuery, type FleaMarketDetailsRow } from './flea-market'
import type { FleaMarketDetails } from '../types'

function makeDetailsRow(overrides: Partial<FleaMarketDetailsRow> = {}): FleaMarketDetailsRow {
  return {
    id: 'fm-1',
    name: 'Södermalms Loppis',
    description: 'Stor loppis i city',
    street: 'Götgatan 1',
    zip_code: '116 21',
    city: 'Stockholm',
    country: 'SE',
    latitude: 59.314,
    longitude: 18.073,
    is_permanent: true,
    is_deleted: false,
    organizer_id: 'org-1',
    auto_accept_bookings: false,
    published_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    location: null,
    profiles: { first_name: 'Anna', last_name: 'Svensson' },
    opening_hour_rules: [
      {
        id: 'r-1',
        flea_market_id: 'fm-1',
        type: 'weekly',
        day_of_week: 6,
        anchor_date: null,
        open_time: '09:00',
        close_time: '15:00',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    opening_hour_exceptions: [
      {
        id: 'e-1',
        flea_market_id: 'fm-1',
        date: '2026-06-06',
        reason: 'Nationaldagen',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    flea_market_images: [
      {
        id: 'img-1',
        flea_market_id: 'fm-1',
        storage_path: 'markets/fm-1/hero.jpg',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  }
}

describe('FleaMarketQuery.details.select', () => {
  it('contains expected join clauses', () => {
    const s = FleaMarketQuery.details.select
    expect(s).toContain('opening_hour_rules (*)')
    expect(s).toContain('opening_hour_exceptions (*)')
    expect(s).toContain('flea_market_images (*)')
    expect(s).toContain('profiles!flea_markets_organizer_id_fkey (first_name, last_name)')
  })
})

describe('FleaMarketQuery.details.mapRow', () => {
  it('maps core scalar fields from the row', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow())
    expect(result.id).toBe('fm-1')
    expect(result.name).toBe('Södermalms Loppis')
    expect(result.city).toBe('Stockholm')
    expect(result.latitude).toBe(59.314)
    expect(result.organizer_id).toBe('org-1')
    expect(result.auto_accept_bookings).toBe(false)
  })

  it('computes organizerName from profiles join', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow())
    expect(result.organizerName).toBe('Anna Svensson')
  })

  it('returns empty organizerName when profiles is null', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow({ profiles: null }))
    expect(result.organizerName).toBe('')
  })

  it('maps opening_hour_rules array preserving type as RuleType', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow())
    expect(result.opening_hour_rules).toHaveLength(1)
    expect(result.opening_hour_rules[0].id).toBe('r-1')
    expect(result.opening_hour_rules[0].type).toBe('weekly')
    expect(result.opening_hour_rules[0].day_of_week).toBe(6)
    expect(result.opening_hour_rules[0].open_time).toBe('09:00')
  })

  it('maps opening_hour_exceptions array', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow())
    expect(result.opening_hour_exceptions).toHaveLength(1)
    expect(result.opening_hour_exceptions[0].id).toBe('e-1')
    expect(result.opening_hour_exceptions[0].date).toBe('2026-06-06')
    expect(result.opening_hour_exceptions[0].reason).toBe('Nationaldagen')
  })

  it('maps flea_market_images array', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow())
    expect(result.flea_market_images).toHaveLength(1)
    expect(result.flea_market_images[0].id).toBe('img-1')
    expect(result.flea_market_images[0].storage_path).toBe('markets/fm-1/hero.jpg')
    expect(result.flea_market_images[0].sort_order).toBe(0)
  })

  it('handles empty arrays for rules, exceptions and images', () => {
    const result = FleaMarketQuery.details.mapRow(
      makeDetailsRow({ opening_hour_rules: [], opening_hour_exceptions: [], flea_market_images: [] }),
    )
    expect(result.opening_hour_rules).toHaveLength(0)
    expect(result.opening_hour_exceptions).toHaveLength(0)
    expect(result.flea_market_images).toHaveLength(0)
  })

  it('satisfies the FleaMarketDetails type contract', () => {
    const result = FleaMarketQuery.details.mapRow(makeDetailsRow())
    // Compile-time check: if FleaMarketDetails shape changes this line will fail to build
    const _typed: FleaMarketDetails = result
    expect(_typed.id).toBeDefined()
  })
})
