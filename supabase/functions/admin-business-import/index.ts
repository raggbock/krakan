import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminBusinessImportInput,
  AdminBusinessImportOutput,
  type ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import'
import {
  buildDryRunReport,
  IMPORTABLE_COLUMNS,
  normalizeForDb,
  type ImportableMarketRow,
} from '@fyndstigen/shared/business-import'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYSTEM_OWNER_ID = 'f1d57000-1000-4000-8000-000000000001'

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

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
    // Geo location, if present, written as PostGIS geography literal.
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

  // Update: never touch organizer_id, is_system_owned, or location.
  const { data, error } = await admin
    .from('flea_markets')
    .update(payload)
    .eq('slug', business.slug)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { id: data!.id as string }
}

async function ensureToken(
  admin: SupabaseClient,
  marketId: string,
  business: ImportBusiness,
): Promise<boolean> {
  if (!business.takeover.shouldSendEmail) return false

  // Skip if there's already an active (unused, unrevoked, unexpired) token.
  const { data: existing, error: selErr } = await admin
    .from('business_owner_tokens')
    .select('id')
    .eq('flea_market_id', marketId)
    .is('used_at', null)
    .is('invalidated_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
  if (selErr) throw new Error(selErr.message)
  if (existing && existing.length > 0) return false

  const tokenHash = await sha256Hex(generateToken())
  const { error: insErr } = await admin.from('business_owner_tokens').insert({
    flea_market_id: marketId,
    token_hash: tokenHash,
    sent_to_email: business.contact?.email ?? null,
    priority: business.takeover.priority,
    should_send_email: true,
  })
  if (insErr) throw new Error(insErr.message)
  return true
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

    // Commit phase: execute writes for create/update rows.
    let tokensCreated = 0
    for (let i = 0; i < report.rows.length; i++) {
      const planned = report.rows[i]
      if (planned.action !== 'create' && planned.action !== 'update') continue
      const business = input.businesses[planned.index]
      try {
        const { id } = await upsertMarket(admin, business, planned.action === 'create')
        if (planned.action === 'create' && await ensureToken(admin, id, business)) {
          tokensCreated++
        }
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

    await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'business.import.commit',
      target_type: 'batch',
      target_id: null,
      payload: {
        total: report.summary.total,
        created: report.summary.created,
        updated: report.summary.updated,
        errors: report.summary.errors,
        tokensCreated,
      },
    })

    return { ...report, dryRun: false, summary: { ...report.summary, tokensCreated } }
  },
})
