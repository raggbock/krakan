import { describe, it, expect } from 'vitest'
import { buildPatch } from './patch-builder'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'

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

const base = makeRow()

describe('buildPatch', () => {
  it('returns empty patch when nothing changed', () => {
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch).toEqual({})
  })

  it('includes name patch when name changed', () => {
    const patch = buildPatch(base, {
      name: 'Nytt Namn',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.name).toBe('Nytt Namn')
    expect(patch.contact).toBeUndefined()
    expect(patch.address).toBeUndefined()
  })

  it('includes contact patch when website changed', () => {
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://new.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.contact).toBeDefined()
    expect(patch.contact?.website).toBe('https://new.com')
    expect(patch.name).toBeUndefined()
  })

  it('includes address patch when street changed', () => {
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Nygatan 5',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.address).toBeDefined()
    expect(patch.address?.street).toBe('Nygatan 5')
  })

  it('includes location patch when coordinates changed', () => {
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 60.0,
      longitude: 18.5,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.location).toEqual({ latitude: 60.0, longitude: 18.5 })
  })

  it('does not include location patch when only one coord changed but other is null', () => {
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: null,
      longitude: 18.5,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.location).toBeUndefined()
  })

  it('includes openingHourRules patch when hoursTouched is true', () => {
    const rules = [{ type: 'weekly' as const, dayOfWeek: 1, anchorDate: null, openTime: '10:00', closeTime: '17:00' }]
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: rules,
      hoursTouched: true,
    })
    expect(patch.openingHourRules).toBeDefined()
    expect(patch.openingHourRules?.length).toBe(1)
  })

  it('does not include openingHourRules when hoursTouched is false', () => {
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.openingHourRules).toBeUndefined()
  })

  it('normalises time strings to HH:MM:SS in openingHourRules', () => {
    const rules = [{ type: 'weekly' as const, dayOfWeek: 1, anchorDate: null, openTime: '09:00', closeTime: '16:00' }]
    const patch = buildPatch(base, {
      name: 'Test Loppis',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: rules,
      hoursTouched: true,
    })
    expect(patch.openingHourRules?.[0].openTime).toBe('09:00:00')
    expect(patch.openingHourRules?.[0].closeTime).toBe('16:00:00')
  })

  it('empty name string is treated as unchanged (trims and ignores blank)', () => {
    const patch = buildPatch(base, {
      name: '   ',
      website: 'https://example.com',
      facebook: '',
      instagram: '',
      phone: '+46700000000',
      email: 'test@example.com',
      street: 'Testgatan 1',
      zipCode: '12345',
      city: 'Stockholm',
      latitude: 59.3,
      longitude: 18.0,
      weeklyRules: [],
      hoursTouched: false,
    })
    expect(patch.name).toBeUndefined()
  })
})
