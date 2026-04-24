import { describe, it, expect } from 'vitest'
import {
  buildDryRunReport,
  normalizeForDb,
  validateRequired,
  validateSoft,
  type ImportableMarketRow,
} from './business-import'
import type { ImportBusiness } from './contracts/admin-business-import'

const validBusiness: ImportBusiness = {
  slug: 'test-loppis',
  name: 'Test Loppis',
  category: 'Privat',
  description: 'En testloppis',
  address: {
    street: 'Bärsta 306',
    postalCode: '715 92',
    locality: 'Stora Mellösa',
    municipality: 'Örebro',
    region: 'Örebro län',
    country: 'SE',
  },
  contact: {
    phone: '+4673502663',
    email: 'info@test.se',
    website: 'https://test.se',
  },
  status: 'confirmed',
  takeover: { shouldSendEmail: true, priority: 1 },
}

describe('validateRequired', () => {
  it('passes a complete business', () => {
    expect(validateRequired(validBusiness)).toEqual([])
  })

  it('catches missing required fields', () => {
    const errors = validateRequired({
      name: 'X',
      address: { locality: 'A', municipality: 'B', region: 'C', country: 'SE' },
    })
    expect(errors).toContain('slug saknas')
    expect(errors).toContain('category saknas')
  })

  it('catches missing address fields', () => {
    const errors = validateRequired({ slug: 's', name: 'n', category: 'Privat' as never })
    expect(errors).toContain('address.locality saknas')
    expect(errors).toContain('address.municipality saknas')
    expect(errors).toContain('address.region saknas')
    expect(errors).toContain('address.country saknas')
  })
})

describe('validateSoft', () => {
  it('warns on bad phone format', () => {
    const w = validateSoft({ ...validBusiness, contact: { phone: '073-502 66 34' } })
    expect(w.some((s) => s.includes('E.164'))).toBe(true)
  })

  it('warns on URL without scheme', () => {
    const w = validateSoft({ ...validBusiness, contact: { website: 'test.se' } })
    expect(w.some((s) => s.includes('http(s)'))).toBe(true)
  })

  it('warns on bad email', () => {
    const w = validateSoft({ ...validBusiness, contact: { email: 'not-an-email' } })
    expect(w.some((s) => s.includes('e-postadress'))).toBe(true)
  })

  it('passes clean contact info', () => {
    expect(validateSoft(validBusiness)).toEqual([])
  })
})

describe('normalizeForDb', () => {
  it('flattens nested fields and applies null defaults', () => {
    const row = normalizeForDb(validBusiness)
    expect(row.slug).toBe('test-loppis')
    expect(row.city).toBe('Stora Mellösa')
    expect(row.zip_code).toBe('715 92')
    expect(row.contact_email).toBe('info@test.se')
  })

  it('uses null when optional fields are missing', () => {
    const minimal: ImportBusiness = {
      ...validBusiness,
      description: undefined,
      contact: undefined,
      address: { ...validBusiness.address, street: undefined, postalCode: undefined },
    }
    const row = normalizeForDb(minimal)
    expect(row.description).toBeNull()
    expect(row.street).toBeNull()
    expect(row.zip_code).toBeNull()
    expect(row.contact_email).toBeNull()
  })
})

describe('buildDryRunReport', () => {
  it('marks new business as create', () => {
    const r = buildDryRunReport({ businesses: [validBusiness] }, new Map())
    expect(r.summary).toMatchObject({ total: 1, created: 1, updated: 0, unchanged: 0, errors: 0 })
    expect(r.rows[0]).toMatchObject({ action: 'create', slug: 'test-loppis' })
  })

  it('marks unchanged when normalized matches existing', () => {
    const existing: ImportableMarketRow = normalizeForDb(validBusiness)
    const r = buildDryRunReport(
      { businesses: [validBusiness] },
      new Map([['test-loppis', existing]]),
    )
    expect(r.summary).toMatchObject({ created: 0, updated: 0, unchanged: 1 })
    expect(r.rows[0].action).toBe('unchanged')
  })

  it('marks update when fields differ', () => {
    const existing = { ...normalizeForDb(validBusiness), name: 'Old name' }
    const r = buildDryRunReport(
      { businesses: [validBusiness] },
      new Map([['test-loppis', existing]]),
    )
    expect(r.summary).toMatchObject({ updated: 1 })
    expect(r.rows[0].action).toBe('update')
  })

  it('reports per-row hard errors without stopping the file', () => {
    const broken = { ...validBusiness, slug: '' }
    const r = buildDryRunReport({ businesses: [broken, validBusiness] }, new Map())
    expect(r.summary).toMatchObject({ errors: 1, created: 1 })
    expect(r.rows[0].action).toBe('error')
    expect(r.rows[1].action).toBe('create')
  })

  it('counts soft warnings but still imports', () => {
    const noisy = { ...validBusiness, contact: { phone: 'bad', website: 'no-scheme' } }
    const r = buildDryRunReport({ businesses: [noisy] }, new Map())
    expect(r.summary.warnings).toBe(2)
    expect(r.rows[0].action).toBe('create')
    expect(r.rows[0].warnings.length).toBe(2)
  })
})
