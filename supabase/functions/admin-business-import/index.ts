import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminBusinessImportInput,
  AdminBusinessImportOutput,
  type ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import.ts'
import {
  buildDryRunReport,
  IMPORTABLE_COLUMNS,
  normalizeForDb,
  type ImportableMarketRow,
} from '@fyndstigen/shared/business-import.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SYSTEM_OWNER_ID } from '../_shared/constants.ts'

async function upsertMarket(
  admin: SupabaseClient,
  business: ImportBusiness,
  isCreate: boolean,
): Promise<{ id: string }> {
  const row = normalizeForDb(business)
  const payload: Record<string, unknown> = { ...row }

  if (isCreate) {
    payload.organizer_id = SYSTEM_OWNER_ID
    payload.is_system_owned = true
    if (business.geo?.lat != null && business.geo?.lng != null) {
      payload.location = `SRID=4326;POINT(${business.geo.lng} ${business.geo.lat})`
    }
    const { data, error } = await admin
      .from('flea_markets')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: data!.id as string }
  }

  const { data, error } = await admin
    .from('flea_markets')
    .update(payload)
    .eq('slug', business.slug)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { id: data!.id as string }
}

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

    const report = buildDryRunReport(input, existingBySlug)
    if (!input.commit) return report

    // Commit phase: execute writes. Tokens are NOT created here —
    // /admin/takeover generates + sends them when admin opts in.
    const committedSlugs: string[] = []
    for (let i = 0; i < report.rows.length; i++) {
      const planned = report.rows[i]
      if (planned.action !== 'create' && planned.action !== 'update') continue
      const business = input.businesses[planned.index]
      try {
        await upsertMarket(admin, business, planned.action === 'create')
        committedSlugs.push(business.slug)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (planned.action === 'create') report.summary.created--
        else report.summary.updated--
        report.summary.errors++
        report.rows[i] = {
          ...planned,
          action: 'error',
          errors: [...planned.errors, `DB-fel: ${msg}`],
        }
      }
    }

    let published = 0
    let publishSkippedNoHours = 0
    if (input.publishOnCommit && committedSlugs.length > 0) {
      // Only publish markets that already have at least one opening_hour_rule.
      // Mirrors the guard in admin-market-edit — never publish without hours.
      const { data: candidateRows, error: candErr } = await admin
        .from('flea_markets')
        .select('id, slug')
        .in('slug', committedSlugs)
        .is('published_at', null)
      if (candErr) {
        console.error('[admin-business-import] publish lookup failed:', candErr.message)
      } else if (candidateRows && candidateRows.length > 0) {
        const ids = candidateRows.map((r) => r.id as string)
        const { data: hourRows, error: hErr } = await admin
          .from('opening_hour_rules')
          .select('flea_market_id')
          .in('flea_market_id', ids)
        if (hErr) {
          console.error('[admin-business-import] hours lookup failed:', hErr.message)
        } else {
          const withHours = new Set((hourRows ?? []).map((r) => r.flea_market_id as string))
          const publishable = ids.filter((id) => withHours.has(id))
          publishSkippedNoHours = ids.length - publishable.length
          if (publishable.length > 0) {
            const { data: pubRows, error: pubErr } = await admin
              .from('flea_markets')
              .update({ published_at: new Date().toISOString() })
              .in('id', publishable)
              .select('id')
            if (pubErr) console.error('[admin-business-import] publish failed:', pubErr.message)
            else published = pubRows?.length ?? 0
          }
        }
      }
    }

    const { error: auditErr } = await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'business.import.commit',
      target_type: 'batch',
      target_id: null,
      payload: {
        total: report.summary.total,
        created: report.summary.created,
        updated: report.summary.updated,
        errors: report.summary.errors,
        published,
        publishSkippedNoHours,
      },
    })
    if (auditErr) console.error('[admin-business-import] audit log failed:', auditErr.message)

    return { ...report, dryRun: false, summary: { ...report.summary, tokensCreated: 0, published } }
  },
})
