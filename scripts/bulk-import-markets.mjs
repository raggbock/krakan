#!/usr/bin/env node
/**
 * Bulk-import markets from a JSON file into flea_markets via PostgREST with
 * the service-role key. Existing rows (matched by slug) are skipped — no
 * updates, no publish, no takeover tokens.
 *
 * Use this when you have a freshly-scraped seed (e.g. OSM) that you want
 * staged invisibly under is_system_owned=true so admin can curate via
 * /admin/markets before publishing anything.
 *
 * Run:
 *   node scripts/bulk-import-markets.mjs supabase/seed/osm-flea-markets.json
 *
 * Env (.env or shell):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The JSON file must match @fyndstigen/shared/contracts/admin-business-import
 * (an object with `businesses: ImportBusiness[]`).
 */

import { readFileSync } from 'node:fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SYSTEM_OWNER_ID = 'f1d57000-1000-4000-8000-000000000001'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/bulk-import-markets.mjs <path-to-json>')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
}

function normalizeForDb(b) {
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
    contact_facebook: b.contact?.facebook ?? null,
    contact_instagram: b.contact?.instagram ?? null,
    organizer_id: SYSTEM_OWNER_ID,
    is_system_owned: true,
    // published_at intentionally unset — caller curates via /admin/markets
  }
}

async function fetchExistingSlugs(slugs) {
  // Chunk the IN clause so URL length stays under PostgREST/CDN limits.
  const out = new Set()
  const CHUNK = 100
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const slice = slugs.slice(i, i + CHUNK)
    const inList = slice.map((s) => `"${encodeURIComponent(s)}"`).join(',')
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/flea_markets?slug=in.(${inList})&select=slug`,
      { headers },
    )
    if (!res.ok) {
      console.error('Lookup failed:', res.status, await res.text())
      process.exit(1)
    }
    const rows = await res.json()
    for (const r of rows) out.add(r.slug)
  }
  return out
}

async function insertBatch(rows) {
  // PostgREST accepts an array body for bulk inserts.
  const payload = rows.map((b) => {
    const row = normalizeForDb(b)
    if (b.geo?.lat != null && b.geo?.lng != null) {
      // latitude/longitude are generated columns derived from location — only write the geography.
      row.location = `SRID=4326;POINT(${b.geo.lng} ${b.geo.lat})`
    }
    return row
  })
  const res = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets`, {
    method: 'POST',
    headers: { ...headers, prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, status: res.status, message: text }
  }
  return { ok: true }
}

const DAY_LABEL_TO_DOW = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

async function fetchSlugIdMap(slugs) {
  const out = new Map()
  const CHUNK = 100
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const slice = slugs.slice(i, i + CHUNK)
    const inList = slice.map((s) => `"${encodeURIComponent(s)}"`).join(',')
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/flea_markets?slug=in.(${inList})&select=id,slug`,
      { headers },
    )
    if (!res.ok) {
      console.error('Slug→id lookup failed:', res.status, await res.text())
      return out
    }
    const rows = await res.json()
    for (const r of rows) out.set(r.slug, r.id)
  }
  return out
}

async function replaceWeeklyHoursForMarket(marketId, regular) {
  // Delete existing weekly rules first (idempotent re-run on re-imports).
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/opening_hour_rules?flea_market_id=eq.${marketId}&type=eq.weekly`,
    { method: 'DELETE', headers },
  )
  if (!delRes.ok) return { ok: false, reason: `delete: ${await delRes.text()}` }

  if (regular.length === 0) return { ok: true, inserted: 0 }

  const rows = regular
    .map((r) => {
      const dow = DAY_LABEL_TO_DOW[r.day]
      if (dow == null || !r.opens || !r.closes) return null
      return {
        flea_market_id: marketId,
        type: 'weekly',
        day_of_week: dow,
        open_time: r.opens.length === 5 ? `${r.opens}:00` : r.opens,
        close_time: r.closes.length === 5 ? `${r.closes}:00` : r.closes,
      }
    })
    .filter(Boolean)
  if (rows.length === 0) return { ok: true, inserted: 0 }

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/opening_hour_rules`, {
    method: 'POST',
    headers: { ...headers, prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!insRes.ok) return { ok: false, reason: `insert: ${await insRes.text()}` }
  return { ok: true, inserted: rows.length }
}

async function fillOpeningHours(businesses) {
  const withHours = businesses.filter(
    (b) => b.slug && b.openingHours && Array.isArray(b.openingHours.regular) && b.openingHours.regular.length > 0,
  )
  if (withHours.length === 0) {
    console.log('No opening hours to fill.')
    return
  }

  console.log()
  console.log(`Filling opening hours for ${withHours.length} markets…`)

  const slugIdMap = await fetchSlugIdMap(withHours.map((b) => b.slug))
  let updated = 0
  let skipped = 0
  let errors = 0
  for (const b of withHours) {
    const id = slugIdMap.get(b.slug)
    if (!id) { skipped++; continue }
    const result = await replaceWeeklyHoursForMarket(id, b.openingHours.regular)
    if (result.ok) updated++
    else { errors++; console.error(`  ${b.slug}: ${result.reason?.slice(0, 120)}`) }
  }
  console.log(`Opening hours: ${updated} updated, ${skipped} no-id-match, ${errors} errors.`)
}

async function main() {
  const json = JSON.parse(readFileSync(inputPath, 'utf8'))
  const businesses = json.businesses ?? json
  if (!Array.isArray(businesses)) {
    console.error('JSON must have a `businesses` array.')
    process.exit(1)
  }

  console.log(`Loaded ${businesses.length} rows from ${inputPath}`)

  const slugs = businesses.map((b) => b.slug).filter(Boolean)
  const existing = await fetchExistingSlugs(slugs)
  const fresh = businesses.filter((b) => b.slug && !existing.has(b.slug))
  console.log(`  ${existing.size} already in DB (skipped on insert)`)
  console.log(`  ${fresh.length} new to insert`)

  if (fresh.length > 0) {
    const BATCH = 50
    let inserted = 0
    let failed = 0
    for (let i = 0; i < fresh.length; i += BATCH) {
      const slice = fresh.slice(i, i + BATCH)
      const result = await insertBatch(slice)
      if (result.ok) {
        inserted += slice.length
        process.stdout.write(`  +${slice.length}`)
      } else {
        failed += slice.length
        console.error(`\n  batch ${i / BATCH + 1} failed (HTTP ${result.status}): ${result.message.slice(0, 200)}`)
      }
    }
    console.log()
    console.log(`Inserted ${inserted}, failed ${failed}.`)
  }

  // Second pass: write opening_hour_rules for any market (new or existing)
  // that has openingHours.regular in the JSON. Idempotent — replaces weekly
  // rules per market.
  await fillOpeningHours(businesses)

  console.log()
  console.log(`Done. All inserted rows are is_system_owned=true with published_at=NULL.`)
  console.log(`Curate them at https://fyndstigen.se/admin/markets`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
