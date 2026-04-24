import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminBusinessImportInput,
  AdminBusinessImportOutput,
} from '@fyndstigen/shared/contracts/admin-business-import'
import {
  buildDryRunReport,
  IMPORTABLE_COLUMNS,
  type ImportableMarketRow,
} from '@fyndstigen/shared/business-import'

defineEndpoint({
  name: 'admin-business-import',
  input: AdminBusinessImportInput,
  output: AdminBusinessImportOutput,
  handler: async ({ user, admin }, input) => {
    const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: user.id })
    if (rpcErr) throw new Error(rpcErr.message)
    if (!isAdminResult) throw new HttpError(403, 'not_admin')

    const slugs = input.businesses.map((b) => b.slug).filter((s): s is string => !!s)

    const { data: existingRows, error: selErr } = await admin
      .from('flea_markets')
      .select(IMPORTABLE_COLUMNS.join(','))
      .in('slug', slugs)
    if (selErr) throw new Error(selErr.message)

    const existingBySlug = new Map<string, ImportableMarketRow>()
    for (const row of (existingRows ?? []) as unknown as ImportableMarketRow[]) {
      existingBySlug.set(row.slug, row)
    }

    return buildDryRunReport(input, existingBySlug)
  },
})
