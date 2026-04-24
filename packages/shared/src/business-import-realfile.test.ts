import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AdminBusinessImportInput } from './contracts/admin-business-import'
import { buildDryRunReport } from './business-import'

describe('real fyndstigen_import.json', () => {
  const raw = readFileSync(
    resolve(__dirname, '../../../supabase/seed/fyndstigen_import.json'),
    'utf-8',
  )
  const parsed = JSON.parse(raw) as { businesses: unknown[] }

  it('matches the zod input schema', () => {
    const result = AdminBusinessImportInput.safeParse({ businesses: parsed.businesses })
    if (!result.success) {
      console.error(JSON.stringify(result.error.issues, null, 2))
    }
    expect(result.success).toBe(true)
  })

  it('produces a clean dry-run report against an empty DB', () => {
    const result = AdminBusinessImportInput.parse({ businesses: parsed.businesses })
    const report = buildDryRunReport(result, new Map())
    expect(report.summary.total).toBe(26)
    expect(report.summary.created).toBe(26)
    expect(report.summary.errors).toBe(0)
  })
})
