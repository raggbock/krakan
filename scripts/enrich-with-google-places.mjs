#!/usr/bin/env node
/**
 * enrich-with-google-places.mjs
 *
 * Use Google Places API (New) to fill missing coordinates + opening
 * hours on markets we already track. Place IDs are cached on
 * flea_markets.google_place_id so future re-fetches skip Text Search.
 *
 * Phase 1 (default): query → write found.json + failed.json. No DB writes.
 * Phase 2 (--apply): apply found.json. Idempotent — skips markets that
 *   already have what they need now (someone may have edited in the meantime).
 *
 * Run:
 *   node --env-file=.env scripts/enrich-with-google-places.mjs
 *   node --env-file=.env scripts/enrich-with-google-places.mjs --apply
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY.
 *
 * ToS notes:
 *   - place_id, latitude, longitude can be stored permanently
 *   - opening hours formally must be refreshed within 30 days; we
 *     stamp updated_at so a periodic refresher script can target stale rows
 *   - we tag the source so the UI can render attribution where required
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep } from './lib/scrape-helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FOUND_PATH = join(here, 'google-places-found.json')
const FAILED_PATH = join(here, 'google-places-failed.json')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in env.')
  console.error('Get one at https://console.cloud.google.com → APIs & Services → Credentials.')
  console.error('Required APIs: "Places API (New)". Enable in console first.')
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
const sbHeaders = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
}

const APPLY = new Set(process.argv.slice(2)).has('--apply')

// ---------------------------------------------------------------------------
// Google Places API (New) — using v1 endpoints with field masks.
//
// Field masks let us pay only for the SKUs we actually consume:
//   - id (place_id)              — basic, free
//   - location                   — basic, free (for searchText)
//   - regularOpeningHours        — Pro/Atmosphere, ~$0.017
//   - editorialSummary           — skipped (rarely populated for charity shops)
// ---------------------------------------------------------------------------

const SEARCH_FIELDS = 'places.id,places.displayName,places.location,places.formattedAddress'
const DETAILS_FIELDS = 'id,displayName,location,regularOpeningHours,formattedAddress'

async function searchPlace({ name, city }) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GOOGLE_KEY,
      'x-goog-fieldmask': SEARCH_FIELDS,
    },
    body: JSON.stringify({
      textQuery: `${name} ${city}`,
      languageCode: 'sv',
      regionCode: 'SE',
      maxResultCount: 5,
    }),
  })
  if (!res.ok) throw new Error(`searchText ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.places ?? []
}

async function getPlaceDetails(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=sv`, {
    headers: {
      'x-goog-api-key': GOOGLE_KEY,
      'x-goog-fieldmask': DETAILS_FIELDS,
    },
  })
  if (!res.ok) throw new Error(`details ${res.status}: ${await res.text()}`)
  return res.json()
}

/**
 * Pick the best match from search results. Heuristic: first place whose
 * formattedAddress contains the city name. If none match by city, take
 * the first result and let the apply phase use sanity checks. Lowercases
 * + diacritic-strips before comparing so "Örebro" === "orebro" passes.
 */
function bestMatch(places, { city }) {
  if (places.length === 0) return null
  const cityNorm = normalizeText(city)
  for (const p of places) {
    const addr = normalizeText(p.formattedAddress ?? '')
    if (addr.includes(cityNorm)) return p
  }
  return places[0]
}

function normalizeText(s) {
  return (s ?? '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
}

/**
 * Convert Google's regularOpeningHours.periods (each with open/close
 * descriptors at a day-of-week granularity) into our opening_hour_rules
 * shape. Google's day numbering: 0 = Sunday … 6 = Saturday — same as
 * Postgres extract(dow), so no conversion needed. Skips entries that
 * are missing fields or that look like 24/7 markers (we only handle
 * regular weekly hours here).
 */
function periodsToRules(periods) {
  const rules = []
  for (const p of periods ?? []) {
    if (!p.open || !p.close) continue
    if (p.open.day == null || p.close.day == null) continue
    if (p.open.day !== p.close.day) {
      // Spans midnight — Google models this as open Mon close Tue. We
      // model as one entry per calendar day. Truncate at midnight to
      // keep it simple; full-night markets are vanishingly rare for our
      // category and the truncation is more honest than fudging.
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

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

async function loadCandidates() {
  // Markets that need either coordinates OR opening hours, are not
  // soft-deleted, and don't already have a cached place_id (re-runs
  // skip the cheap Text Search step).
  const select = 'id,slug,name,city,street,location,google_place_id,'
    + 'opening_hour_rules(id)'
  const filter = 'is_deleted=eq.false'
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
  return all.filter((m) => {
    const noCoords = m.location == null
    const noHours = !m.opening_hour_rules || m.opening_hour_rules.length === 0
    return noCoords || noHours
  })
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function scrape() {
  const candidates = await loadCandidates()
  console.log(`Querying Google Places for ${candidates.length} markets…`)

  const found = []
  const failed = []

  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i]
    const tag = `[${i + 1}/${candidates.length}] ${m.name} (${m.city})`
    try {
      let placeId = m.google_place_id
      let location = null
      let address = null
      if (!placeId) {
        const places = await searchPlace({ name: m.name, city: m.city })
        const best = bestMatch(places, { city: m.city })
        if (!best) {
          failed.push({ id: m.id, name: m.name, city: m.city, reason: 'no_match' })
          console.log(`${tag} — no Google match`)
          continue
        }
        placeId = best.id
        location = best.location
        address = best.formattedAddress
      }
      // Get details whether we found place_id now or it was cached.
      const details = await getPlaceDetails(placeId)
      const rules = periodsToRules(details.regularOpeningHours?.periods)
      const detailsLocation = details.location ?? location
      const detailsAddress = details.formattedAddress ?? address

      found.push({
        id: m.id,
        slug: m.slug,
        name: m.name,
        city: m.city,
        place_id: placeId,
        // Only keep coords when we'd actually use them — i.e. row is
        // missing them today. Saves apply-phase work and avoids
        // overwriting better local data.
        coordinates: m.location == null && detailsLocation
          ? { latitude: detailsLocation.latitude, longitude: detailsLocation.longitude }
          : null,
        rules: m.opening_hour_rules?.length ? null : rules,
        google_address: detailsAddress,
        google_name: details.displayName?.text,
      })
      const summary = []
      if (found.at(-1).coordinates) summary.push('coords')
      if (found.at(-1).rules) summary.push(`${rules.length} rule(s)`)
      console.log(`${tag} → ${summary.join(', ') || 'place_id only'}`)
    } catch (err) {
      failed.push({ id: m.id, name: m.name, city: m.city, reason: String(err.message ?? err) })
      console.log(`${tag} — error: ${err.message ?? err}`)
    }
    // Google allows ~600 QPS, we don't need to throttle hard. 100ms is
    // a safety margin against bursts on free-tier projects.
    await sleep(100)
  }

  writeFileSync(FOUND_PATH, JSON.stringify(found, null, 2), 'utf8')
  writeFileSync(FAILED_PATH, JSON.stringify(failed, null, 2), 'utf8')
  console.log('')
  console.log(`✓ Found:  ${found.length}  → ${FOUND_PATH}`)
  console.log(`✗ Failed: ${failed.length} → ${FAILED_PATH}`)
  console.log('')
  console.log('Sanity check found.json (especially mismatched names/cities), then --apply.')
}

async function apply() {
  const found = JSON.parse(readFileSync(FOUND_PATH, 'utf8'))
  console.log(`Applying ${found.length} markets…`)

  let applied = 0
  let skipped = 0
  let failed = 0

  for (const m of found) {
    // Re-check current state — someone may have manually edited since the
    // scrape phase. Don't overwrite human-entered data.
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${m.id}&select=location,google_place_id,opening_hour_rules(id)`,
      { headers: sbHeaders },
    )
    const [row] = await checkRes.json()
    if (!row) { failed++; console.log(`FAIL ${m.name} — not found`); continue }

    const update = { google_place_id: m.place_id }
    if (m.coordinates && row.location == null) {
      update.location = `SRID=4326;POINT(${m.coordinates.longitude} ${m.coordinates.latitude})`
    }
    const willInsertRules = m.rules && (!row.opening_hour_rules || row.opening_hour_rules.length === 0)

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${m.id}`, {
      method: 'PATCH',
      headers: sbHeaders,
      body: JSON.stringify(update),
    })
    if (!patchRes.ok) {
      failed++
      console.log(`FAIL ${m.name} — patch ${patchRes.status} ${await patchRes.text()}`)
      continue
    }

    if (willInsertRules && m.rules && m.rules.length > 0) {
      const rows = m.rules.map((r) => ({
        flea_market_id: m.id,
        type: 'weekly',
        day_of_week: r.day_of_week,
        open_time: r.open_time,
        close_time: r.close_time,
      }))
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/opening_hour_rules`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify(rows),
      })
      if (!ins.ok) {
        failed++
        console.log(`FAIL ${m.name} — rules ${ins.status} ${await ins.text()}`)
        continue
      }
    }

    applied++
    const parts = []
    if (update.location) parts.push('coords')
    if (willInsertRules) parts.push(`${m.rules.length} rule(s)`)
    parts.push(`place_id=${m.place_id.slice(0, 12)}…`)
    console.log(`OK   ${m.name} — ${parts.join(', ')}`)

    if (Object.keys(update).length === 1 && !willInsertRules) {
      // We only stamped place_id — counted as applied but worth visibility.
      skipped++ // adjust: not a true skip, but tracked as cache-only
    }
  }

  console.log('')
  console.log(`Applied: ${applied}  (${skipped} cache-only)  Failed: ${failed}`)
}

if (APPLY) await apply()
else await scrape()
