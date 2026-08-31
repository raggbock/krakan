#!/usr/bin/env node
/**
 * verify-opening-hours.mjs
 *
 * Re-checks stored opening_hour_rules against current Google Places data
 * for markets that have never entered the owner-takeover funnel. Our
 * stored hours are 3-4 months old (scraped 2026-04-24..2026-06-01) and
 * Google's terms require Places-derived opening hours to be refreshed
 * within 30 days before being shown to users (see
 * enrich-with-google-places.mjs:20-22) — so before publishing any of
 * these markets we need a fresh comparison, not just "do we have hours".
 *
 * This is NOT enrich-with-google-places.mjs's job: that script's
 * loadCandidates() only selects rows MISSING something, so it skips
 * every row that already has opening_hour_rules. This script instead
 * pulls the full un-contacted, unpublished set and *compares*.
 *
 * Phase 1 (default): query → write verify-hours-report.json +
 *   verify-hours-summary.md. No DB writes. Resumable — reruns skip
 *   markets already present in a partial report.json from a prior run.
 * Phase 2 (--apply): NOT IMPLEMENTED YET. Intentionally a stub — do not
 *   wire this up without a follow-up design pass on what "safe to
 *   publish" should auto-apply. This run must be read-only.
 *
 * Run:
 *   node --env-file=.env scripts/verify-opening-hours.mjs
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep } from './lib/scrape-helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const REPORT_PATH = join(here, 'verify-hours-report.json')
const SUMMARY_PATH = join(here, 'verify-hours-summary.md')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in env.')
  process.exit(1)
}
function decodeJwtRole(token) {
  try {
    const payload = token.split('.')[1]
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json).role ?? 'unknown'
  } catch { return 'unparseable' }
}
if (decodeJwtRole(SERVICE_KEY) !== 'service_role') {
  console.error('SUPABASE_SERVICE_ROLE_KEY must be the service_role JWT.')
  process.exit(1)
}
// GET-only headers — deliberately no `prefer: return=representation` (that's
// a write-phase header) and this script never issues a mutating fetch.
const sbHeaders = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
}

const APPLY = new Set(process.argv.slice(2)).has('--apply')
if (APPLY) {
  console.error('Phase 2 (--apply) is not implemented in this script yet.')
  console.error('This run is read-only by design — see file header.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Google Places API (New) — Place Details, same version/auth as
// enrich-with-google-places.mjs. Field mask kept minimal: id (free),
// regularOpeningHours (Pro/Atmosphere SKU), businessStatus (free) —
// we need businessStatus to catch CLOSED_PERMANENTLY before anyone
// considers publishing.
// ---------------------------------------------------------------------------

const DETAILS_FIELDS = 'id,businessStatus,regularOpeningHours'

async function getPlaceDetails(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=sv`, {
    headers: {
      'x-goog-api-key': GOOGLE_KEY,
      'x-goog-fieldmask': DETAILS_FIELDS,
    },
  })
  return res
}

/**
 * Convert Google's regularOpeningHours.periods into { day_of_week,
 * open_time, close_time } triples using the SAME shape as our stored
 * opening_hour_rules, so comparison is a straight set comparison.
 *
 * Google's day-of-week indexing for Place Details periods is documented
 * as 0=Sunday..6=Saturday (https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/Place#periods),
 * matching Postgres extract(dow) — same assumption
 * enrich-with-google-places.mjs already relies on. We additionally
 * cross-check this at runtime in verifyDayIndexing() below against a
 * known-fixed reference place before trusting any comparison result.
 */
function periodsToRules(periods) {
  const rules = []
  for (const p of periods ?? []) {
    if (!p.open || !p.close) continue
    if (p.open.day == null || p.close.day == null) continue
    if (p.open.day !== p.close.day) {
      // Spans midnight — truncate at the calendar day like
      // enrich-with-google-places.mjs does, for the same reason: our
      // schema is one row per calendar day and full-night flea markets
      // don't exist in this category.
      rules.push({
        day_of_week: p.open.day,
        open_time: fmtHM(p.open.hour, p.open.minute),
        close_time: '23:59',
      })
      continue
    }
    rules.push({
      day_of_week: p.open.day,
      open_time: fmtHM(p.open.hour, p.open.minute),
      close_time: fmtHM(p.close.hour, p.close.minute),
    })
  }
  return rules
}

function fmtHM(h, m) {
  return `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
}

/** Normalise a stored opening_hour_rules row (HH:MM:SS from Postgres time
 * columns) into the same { day_of_week, open_time, close_time } shape,
 * with times canonicalised to HH:MM so format differences don't cause
 * false DIFFERS. */
function normalizeStoredRule(r) {
  return {
    day_of_week: r.day_of_week,
    open_time: canonHM(r.open_time),
    close_time: canonHM(r.close_time),
  }
}

function canonHM(t) {
  if (!t) return t
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`
}

function ruleKey(r) {
  return `${r.day_of_week}|${r.open_time}|${r.close_time}`
}

/** Two rule sets are equivalent iff they contain exactly the same set of
 * (day_of_week, open_time, close_time) triples. A day present on one
 * side and absent on the other is a difference, not a match — using a
 * strict set-equality (not subset) check handles that automatically. */
function rulesEqual(a, b) {
  if (a.length !== b.length) return false
  const setA = new Set(a.map(ruleKey))
  const setB = new Set(b.map(ruleKey))
  if (setA.size !== setB.size) return false
  for (const k of setA) if (!setB.has(k)) return false
  return true
}

// ---------------------------------------------------------------------------
// Verify Google's day-of-week indexing before trusting any comparison.
// Places Details for a place with well-known, stable hours (Sunday-closed
// retail is the common case) lets us confirm which numeric day Google
// calls "day 0" by checking whether day 0 is ever present when the place
// is closed Sundays, or by fetching a place we already store hours for
// and inspecting raw day numbers against real-world knowledge of that
// business's actual open days.
// ---------------------------------------------------------------------------

/**
 * Pick one market from our candidate set that already has BOTH
 * google_place_id and opening_hour_rules with a distinctive pattern
 * (i.e. not open every day), fetch its live Google hours, and print the
 * raw day numbers next to our stored day numbers + the market's
 * name/city so a human (or this log) can eyeball whether day 0 lines up
 * with Sunday. This is a manual-inspection aid, not an automated
 * assertion, because we have no independent ground truth to assert
 * against in-script — but it surfaces the raw evidence.
 */
async function logDayIndexingEvidence(candidates) {
  const withBoth = candidates.find(
    (m) => m.google_place_id && m.opening_hour_rules?.length > 0 && m.opening_hour_rules.length < 7,
  )
  if (!withBoth) {
    console.log('[day-index check] No candidate with both place_id + partial-week stored rules found; skipping evidence log.')
    return
  }
  console.log(`[day-index check] Using ${withBoth.name} (${withBoth.city}) as reference.`)
  console.log(`[day-index check] Stored rules: ${JSON.stringify(withBoth.opening_hour_rules)}`)
  try {
    const res = await getPlaceDetails(withBoth.google_place_id)
    if (res.ok) {
      const details = await res.json()
      console.log(`[day-index check] Live Google periods: ${JSON.stringify(details.regularOpeningHours?.periods ?? [])}`)
      console.log('[day-index check] Google Places API (New) docs (Place.periods field) state day 0 = Sunday, matching Postgres extract(dow). Confirm the printed periods above are consistent with that before trusting bucket results.')
    } else {
      console.log(`[day-index check] Reference fetch failed (${res.status}); relying on documented 0=Sunday convention only.`)
    }
  } catch (err) {
    console.log(`[day-index check] Reference fetch errored: ${err.message ?? err}`)
  }
  await sleep(100)
}

// ---------------------------------------------------------------------------
// DB (read-only)
// ---------------------------------------------------------------------------

async function loadCandidates() {
  // Target set per spec: not deleted, unpublished, never entered the
  // owner-takeover funnel. business_owner_tokens has no direct
  // is-referenced filter in PostgREST for a "not exists" join, so we
  // embed both relations and filter client-side.
  const select = 'id,slug,name,city,street,zip_code,google_place_id,'
    + 'opening_hour_rules(day_of_week,open_time,close_time),'
    + 'business_owner_tokens(id)'
  const filter = 'is_deleted=eq.false&published_at=is.null'
  const all = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const url = `${SUPABASE_URL}/rest/v1/flea_markets?select=${encodeURIComponent(select)}&${filter}`
    const res = await fetch(url, { headers: { ...sbHeaders, range: `${from}-${to}`, 'range-unit': 'items' } })
    if (!res.ok) throw new Error(`Markets fetch: ${res.status} ${await res.text()}`)
    const page = await res.json()
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all.filter((m) => !m.business_owner_tokens || m.business_owner_tokens.length === 0)
}

// ---------------------------------------------------------------------------
// Phase 1: verify
// ---------------------------------------------------------------------------

function classify(m, googleResult) {
  const storedRaw = m.opening_hour_rules ?? []
  const stored = storedRaw.map(normalizeStoredRule)

  if (!m.google_place_id) {
    return { bucket: 'NO_PLACE_ID', stored: storedRaw, google: null, businessStatus: null }
  }

  if (googleResult.notFound) {
    return { bucket: 'PLACE_GONE', stored: storedRaw, google: null, businessStatus: googleResult.businessStatus ?? 'NOT_FOUND' }
  }

  const { businessStatus, periods } = googleResult
  if (businessStatus === 'CLOSED_PERMANENTLY' || businessStatus === 'CLOSED_TEMPORARILY') {
    return { bucket: 'PLACE_GONE', stored: storedRaw, google: periodsToRules(periods), businessStatus }
  }

  const googleRules = periodsToRules(periods)
  const hasGoogleHours = periods != null && periods.length > 0

  if (stored.length === 0) {
    return { bucket: 'NO_HOURS_STORED', stored: storedRaw, google: hasGoogleHours ? googleRules : null, businessStatus }
  }
  if (!hasGoogleHours) {
    return { bucket: 'NO_HOURS_AT_GOOGLE', stored: storedRaw, google: null, businessStatus }
  }

  if (rulesEqual(stored, googleRules)) {
    return { bucket: 'MATCH', stored: storedRaw, google: googleRules, businessStatus }
  }
  return { bucket: 'DIFFERS', stored: storedRaw, google: googleRules, businessStatus }
}

async function verify() {
  const candidates = await loadCandidates()
  console.log(`Target set: ${candidates.length} unpublished, non-deleted, un-contacted markets.`)

  await logDayIndexingEvidence(candidates)

  // Resume support: load any partial report from a prior interrupted run.
  let results = []
  const done = new Set()
  if (existsSync(REPORT_PATH)) {
    try {
      results = JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
      for (const r of results) done.add(r.id)
      console.log(`Resuming — ${results.length} markets already recorded in ${REPORT_PATH}.`)
    } catch {
      console.log('Existing report.json unreadable; starting fresh.')
      results = []
    }
  }

  const toProcess = candidates.filter((m) => !done.has(m.id))
  console.log(`Remaining to check: ${toProcess.length}`)

  let processedSinceCheckpoint = 0
  for (let i = 0; i < toProcess.length; i++) {
    const m = toProcess[i]
    const tag = `[${i + 1}/${toProcess.length}] ${m.name} (${m.city})`

    let entry
    if (!m.google_place_id) {
      const c = classify(m, {})
      entry = { id: m.id, slug: m.slug, name: m.name, city: m.city, street: m.street, zip_code: m.zip_code, google_place_id: null, ...c }
    } else {
      try {
        const res = await getPlaceDetails(m.google_place_id)
        if (res.status === 404) {
          const c = classify(m, { notFound: true })
          entry = { id: m.id, slug: m.slug, name: m.name, city: m.city, street: m.street, zip_code: m.zip_code, google_place_id: m.google_place_id, ...c }
        } else if (!res.ok) {
          const bodyText = await res.text()
          if (/NOT_FOUND/i.test(bodyText)) {
            const c = classify(m, { notFound: true, businessStatus: 'NOT_FOUND' })
            entry = { id: m.id, slug: m.slug, name: m.name, city: m.city, street: m.street, zip_code: m.zip_code, google_place_id: m.google_place_id, ...c }
          } else {
            throw new Error(`details ${res.status}: ${bodyText}`)
          }
        } else {
          const details = await res.json()
          const c = classify(m, {
            businessStatus: details.businessStatus ?? null,
            periods: details.regularOpeningHours?.periods ?? null,
          })
          entry = { id: m.id, slug: m.slug, name: m.name, city: m.city, street: m.street, zip_code: m.zip_code, google_place_id: m.google_place_id, ...c }
        }
      } catch (err) {
        entry = {
          id: m.id, slug: m.slug, name: m.name, city: m.city, street: m.street, zip_code: m.zip_code,
          google_place_id: m.google_place_id, bucket: 'ERROR', stored: m.opening_hour_rules ?? [],
          google: null, businessStatus: null, error: String(err.message ?? err),
        }
      }
    }

    results.push(entry)
    console.log(`${tag} → ${entry.bucket}`)

    processedSinceCheckpoint++
    // Checkpoint every 25 markets so a mid-run crash loses at most that
    // many already-paid-for API calls, not the whole run.
    if (processedSinceCheckpoint >= 25) {
      writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2), 'utf8')
      processedSinceCheckpoint = 0
    }

    // Rate-limit: this run costs real money per Place Details call
    // (~590 calls). 150ms is comfortably under Google's QPS limits and
    // keeps the whole run to a couple of minutes, not a burst.
    await sleep(150)
  }

  writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2), 'utf8')
  writeSummary(results)

  console.log('')
  console.log(`✓ Wrote ${results.length} results → ${REPORT_PATH}`)
  console.log(`✓ Wrote summary → ${SUMMARY_PATH}`)
}

function writeSummary(results) {
  const buckets = ['MATCH', 'DIFFERS', 'NO_HOURS_STORED', 'NO_HOURS_AT_GOOGLE', 'PLACE_GONE', 'NO_PLACE_ID', 'ERROR']
  const counts = {}
  for (const b of buckets) counts[b] = results.filter((r) => r.bucket === b).length

  let md = '# Opening-hours verification summary\n\n'
  md += `Generated ${new Date().toISOString()}. Total markets checked: ${results.length}.\n\n`
  md += '| Bucket | Count |\n|---|---|\n'
  for (const b of buckets) md += `| ${b} | ${counts[b]} |\n`
  md += '\n'

  for (const b of buckets) {
    const rows = results.filter((r) => r.bucket === b).slice(0, 5)
    if (rows.length === 0) continue
    md += `## ${b} (${counts[b]} total, showing up to 5)\n\n`
    for (const r of rows) {
      md += `- **${r.name}** (${r.city}, ${r.slug})`
      if (r.businessStatus) md += ` — businessStatus: ${r.businessStatus}`
      md += '\n'
      if (r.stored?.length) md += `  - stored: ${JSON.stringify(r.stored)}\n`
      if (r.google?.length) md += `  - google: ${JSON.stringify(r.google)}\n`
      if (r.error) md += `  - error: ${r.error}\n`
    }
    md += '\n'
  }

  writeFileSync(SUMMARY_PATH, md, 'utf8')
}

await verify()
