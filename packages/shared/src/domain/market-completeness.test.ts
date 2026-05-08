import { describe, it, expect } from 'vitest'
import { marketCompleteness } from './market-completeness'
import type { AdminMarketRow } from '../contracts/admin-markets-overview'

function makeRow(overrides: Partial<AdminMarketRow> = {}): AdminMarketRow {
  return {
    id: 'test-id',
    slug: 'test-slug',
    name: 'Test Loppis',
    city: 'Stockholm',
    street: 'Testgatan 1',
    zipCode: '12345',
    country: 'SE',
    status: 'confirmed',
    category: null,
    isSystemOwned: false,
    isPublished: true,
    isPermanent: true,
    contactWebsite: 'https://example.com',
    contactFacebook: null,
    contactInstagram: null,
    contactPhone: '+46700000000',
    contactEmail: 'test@example.com',
    hasWebsite: true,
    hasFacebook: false,
    hasInstagram: false,
    hasPhone: true,
    hasEmail: true,
    hasOpeningHours: true,
    hasCoordinates: true,
    latitude: 59.3,
    longitude: 18.0,
    openingHourRules: [],
    takeover: null,
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

const completeRow = makeRow()

describe('marketCompleteness', () => {
  it('returns isComplete=true for a fully filled row', () => {
    const result = marketCompleteness(completeRow)
    expect(result.isComplete).toBe(true)
    expect(result.isAlmostComplete).toBe(true)
    expect(result.missingFields).toEqual([])
  })

  it('detects missing street', () => {
    const result = marketCompleteness(makeRow({ street: null }))
    expect(result.missingFields).toContain('address')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing zipCode', () => {
    const result = marketCompleteness(makeRow({ zipCode: null }))
    expect(result.missingFields).toContain('address')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing city', () => {
    const result = marketCompleteness(makeRow({ city: null }))
    expect(result.missingFields).toContain('address')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing coordinates', () => {
    const result = marketCompleteness(makeRow({ hasCoordinates: false }))
    expect(result.missingFields).toContain('lat_lng')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing opening hours', () => {
    const result = marketCompleteness(makeRow({ hasOpeningHours: false }))
    expect(result.missingFields).toContain('opening_hours')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing website (any absent contact = organizer incomplete)', () => {
    const result = marketCompleteness(makeRow({ hasWebsite: false }))
    expect(result.missingFields).toContain('organizer')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing phone (any absent contact = organizer incomplete)', () => {
    const result = marketCompleteness(makeRow({ hasPhone: false }))
    expect(result.missingFields).toContain('organizer')
    expect(result.isComplete).toBe(false)
  })

  it('detects missing email (any absent contact = organizer incomplete)', () => {
    const result = marketCompleteness(makeRow({ hasEmail: false }))
    expect(result.missingFields).toContain('organizer')
    expect(result.isComplete).toBe(false)
  })

  it('isAlmostComplete when only one field group missing', () => {
    const result = marketCompleteness(makeRow({ hasOpeningHours: false }))
    expect(result.isAlmostComplete).toBe(true)
    expect(result.isComplete).toBe(false)
  })

  it('isAlmostComplete=false when two or more field groups missing', () => {
    const result = marketCompleteness(makeRow({ hasOpeningHours: false, hasCoordinates: false }))
    expect(result.isAlmostComplete).toBe(false)
    expect(result.isComplete).toBe(false)
  })

  it('accumulates multiple missing fields', () => {
    const result = marketCompleteness(makeRow({
      street: null,
      hasCoordinates: false,
      hasOpeningHours: false,
      hasWebsite: false,
      hasPhone: false,
      hasEmail: false,
    }))
    expect(result.missingFields).toContain('address')
    expect(result.missingFields).toContain('lat_lng')
    expect(result.missingFields).toContain('opening_hours')
    expect(result.missingFields).toContain('organizer')
    expect(result.isComplete).toBe(false)
    expect(result.isAlmostComplete).toBe(false)
  })

  it('address is missing only when ALL of street, zip, city are absent', () => {
    expect(marketCompleteness(makeRow({ street: null })).missingFields).toContain('address')
    expect(marketCompleteness(makeRow({ street: null, zipCode: null })).missingFields).toContain('address')
    expect(marketCompleteness(makeRow({ street: null, zipCode: null, city: null })).missingFields).toContain('address')
  })

  it('organizer is missing when any of website, phone, email are absent', () => {
    expect(marketCompleteness(makeRow({ hasWebsite: false, hasPhone: false, hasEmail: false })).missingFields).toContain('organizer')
    expect(marketCompleteness(makeRow({ hasWebsite: false })).missingFields).toContain('organizer')
    expect(marketCompleteness(makeRow({ hasPhone: false })).missingFields).toContain('organizer')
    expect(marketCompleteness(makeRow({ hasEmail: false })).missingFields).toContain('organizer')
  })

  it('no duplicate missingFields entries', () => {
    const result = marketCompleteness(makeRow({ street: null, zipCode: null }))
    const addressCount = result.missingFields.filter((f) => f === 'address').length
    expect(addressCount).toBe(1)
  })
})
