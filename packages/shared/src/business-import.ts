import type { ImportBusiness, ImportRowResult } from './contracts/admin-business-import'

/**
 * Subset of flea_markets columns we manage via import. Matches what
 * normalizeForDb() produces, so the dry-run can diff existing rows
 * against the would-be writes.
 */
export type ImportableMarketRow = {
  slug: string
  name: string
  description: string | null
  category: string | null
  status: string
  street: string | null
  zip_code: string | null
  city: string | null
  municipality: string | null
  region: string | null
  country: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_website: string | null
}

export const IMPORTABLE_COLUMNS: (keyof ImportableMarketRow)[] = [
  'slug', 'name', 'description', 'category', 'status',
  'street', 'zip_code', 'city', 'municipality', 'region', 'country',
  'contact_email', 'contact_phone', 'contact_website',
]

const URL_FIELDS: (keyof NonNullable<ImportBusiness['contact']>)[] = [
  'website', 'facebook', 'instagram',
]

export function normalizeForDb(b: ImportBusiness): ImportableMarketRow {
  return {
    slug: b.slug,
    name: b.name,
    description: b.description ?? null,
    category: b.category,
    status: b.status,
    street: b.address.street ?? null,
    zip_code: b.address.postalCode ?? null,
    city: b.address.locality,
    municipality: b.address.municipality,
    region: b.address.region,
    country: b.address.country,
    contact_email: b.contact?.email ?? null,
    contact_phone: b.contact?.phone ?? null,
    contact_website: b.contact?.website ?? null,
  }
}

/** Hard errors stop the row but not the file. */
export function validateRequired(b: Partial<ImportBusiness>): string[] {
  const errors: string[] = []
  if (!b.slug) errors.push('slug saknas')
  if (!b.name) errors.push('name saknas')
  if (!b.category) errors.push('category saknas')
  if (!b.address?.locality) errors.push('address.locality saknas')
  if (!b.address?.municipality) errors.push('address.municipality saknas')
  if (!b.address?.region) errors.push('address.region saknas')
  if (!b.address?.country) errors.push('address.country saknas')
  return errors
}

/** Soft warnings — row still imports. */
export function validateSoft(b: ImportBusiness): string[] {
  const warnings: string[] = []
  if (b.contact?.phone && !/^\+\d{6,}$/.test(b.contact.phone)) {
    warnings.push(`contact.phone "${b.contact.phone}" är inte i E.164-format`)
  }
  for (const field of URL_FIELDS) {
    const v = b.contact?.[field]
    if (v && !/^https?:\/\//i.test(v)) {
      warnings.push(`contact.${field} "${v}" saknar http(s)://-schema`)
    }
  }
  if (b.contact?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contact.email)) {
    warnings.push(`contact.email "${b.contact.email}" ser inte ut som en e-postadress`)
  }
  return warnings
}

export function rowsEqual(a: ImportableMarketRow, b: ImportableMarketRow): boolean {
  return IMPORTABLE_COLUMNS.every((k) => a[k] === b[k])
}

export type DryRunReport = {
  dryRun: true
  summary: {
    total: number
    created: number
    updated: number
    unchanged: number
    errors: number
    warnings: number
  }
  rows: ImportRowResult[]
}

/**
 * Compute a dry-run diff: which businesses would be created, updated,
 * unchanged, or rejected — without writing anything.
 */
export function buildDryRunReport(
  input: { businesses: ImportBusiness[] },
  existingBySlug: Map<string, ImportableMarketRow>,
): DryRunReport {
  const rows: ImportRowResult[] = []
  let created = 0, updated = 0, unchanged = 0, errors = 0, warnings = 0

  input.businesses.forEach((b, index) => {
    const hardErrors = validateRequired(b)
    if (hardErrors.length > 0) {
      errors++
      rows.push({
        index,
        slug: b.slug ?? null,
        action: 'error',
        errors: hardErrors,
        warnings: [],
      })
      return
    }

    const softWarnings = validateSoft(b)
    if (softWarnings.length > 0) warnings += softWarnings.length

    const normalized = normalizeForDb(b)
    const existing = existingBySlug.get(b.slug)

    let action: 'create' | 'update' | 'unchanged'
    if (!existing) {
      action = 'create'
      created++
    } else if (rowsEqual(existing, normalized)) {
      action = 'unchanged'
      unchanged++
    } else {
      action = 'update'
      updated++
    }

    rows.push({
      index,
      slug: b.slug,
      action,
      errors: [],
      warnings: softWarnings,
    })
  })

  return {
    dryRun: true,
    summary: {
      total: input.businesses.length,
      created,
      updated,
      unchanged,
      errors,
      warnings,
    },
    rows,
  }
}
