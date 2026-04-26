#!/usr/bin/env node
/**
 * Enrich unpublished system-owned markets with whatever Nominatim can
 * give us for free: postal code, refined locality/municipality/region,
 * and coordinates for the small set that still lacks them. Idempotent —
 * skips fields that are already set.
 *
 *   node scripts/enrich-unpublished-markets.mjs           # dry-run
 *   node scripts/enrich-unpublished-markets.mjs --commit  # writes
 *   node scripts/enrich-unpublished-markets.mjs --commit --limit 50
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Strategy per row:
 *   1. If lat+lng present → reverse-geocode → fill postcode/municipality/
 *      region (only if currently null/empty).
 *   2. Else if street+city present → forward-geocode → fill coords +
 *      postcode/municipality/region.
 *   3. Else: skip — not enough signal.
 *
 * Nominatim policy: max 1 req/s, real user-agent. The script paces itself.
 * What it does NOT touch: telefon, email, webbplats, öppettider, beskrivning
 * (those need Google Places or per-source scraping; out of scope here).
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COMMIT = process.argv.includes('--commit')
const LIMIT_FLAG = process.argv.indexOf('--limit')
const LIMIT = LIMIT_FLAG > -1 ? parseInt(process.argv[LIMIT_FLAG + 1], 10) : null

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'Fyndstigen/1.0 (sebastian.myrdahl@gmail.com)'
const PAGE = 1000

const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchAllUnpublished() {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/flea_markets?` +
      `select=id,name,city,street,zip_code,region,municipality,latitude,longitude` +
      `&is_deleted=eq.false&published_at=is.null&is_system_owned=eq.true` +
      `&order=updated_at.desc`
    const res = await fetch(url, {
      headers: { ...headers, range: `${from}-${from + PAGE - 1}`, prefer: 'count=exact' },
    })
    if (!res.ok) {
      console.error('lookup failed:', res.status, await res.text())
      process.exit(1)
    }
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}&zoom=18`
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'sv' } })
  if (!res.ok) return null
  const data = await res.json()
  return parseAddress(data?.address)
}

async function forwardGeocode(query) {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'sv' } })
  if (!res.ok) return null
  const arr = await res.json()
  if (!arr.length) return null
  const r = arr[0]
  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    ...parseAddress(r.address),
  }
}

function parseAddress(addr) {
  if (!addr) return null
  return {
    postcode: addr.postcode ? addr.postcode.replace(/\s+/g, ' ') : null,
    region: addr.state || addr.county || null,
    municipality: addr.municipality || addr.city_district || addr.city || addr.town || addr.village || null,
    locality: addr.city || addr.town || addr.village || addr.suburb || null,
  }
}

function pickUpdates(row, geo) {
  const update = {}
  if (geo.lat != null && geo.lng != null && (row.latitude == null || row.longitude == null)) {
    update.location = `SRID=4326;POINT(${geo.lng} ${geo.lat})`
  }
  if (!row.zip_code && geo.postcode) update.zip_code = geo.postcode
  if (!row.region && geo.region) update.region = geo.region
  if (!row.municipality && geo.municipality) update.municipality = geo.municipality
  if ((!row.city || row.city.length < 2) && geo.locality) update.city = geo.locality
  return update
}

async function patchMarket(id, update) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, prefer: 'return=minimal' },
    body: JSON.stringify(update),
  })
  if (!res.ok) {
    return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 200)}` }
  }
  return { ok: true }
}

async function main() {
  console.log(`Mode: ${COMMIT ? 'COMMIT (writes)' : 'DRY-RUN (no writes)'}`)
  if (LIMIT) console.log(`Limit: ${LIMIT}`)
  console.log()

  const rows = await fetchAllUnpublished()
  const targets = rows.filter((r) => {
    const hasCoords = r.latitude != null && r.longitude != null
    const hasAddress = r.street && r.city
    return hasCoords || hasAddress
  })
  const skipped = rows.length - targets.length
  console.log(`Total unpublished: ${rows.length}`)
  console.log(`Skipped (no coords AND no street+city): ${skipped}`)
  console.log(`Candidates for enrichment: ${targets.length}`)
  if (LIMIT) targets.splice(LIMIT)
  console.log(`Processing: ${targets.length}`)
  console.log()

  const stats = {
    processed: 0,
    enriched: 0,
    noChange: 0,
    geocodeFailed: 0,
    writeFailed: 0,
    fields: { zip_code: 0, region: 0, municipality: 0, city: 0, location: 0 },
  }

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i]
    stats.processed++
    process.stderr.write(`  [${i + 1}/${targets.length}] ${r.name?.slice(0, 50) ?? r.id}`)

    let geo = null
    if (r.latitude != null && r.longitude != null) {
      geo = await reverseGeocode(r.latitude, r.longitude)
    } else if (r.street && r.city) {
      geo = await forwardGeocode(`${r.street}, ${r.city}, Sverige`)
    }

    if (!geo) {
      stats.geocodeFailed++
      process.stderr.write(` — no geo data\n`)
      await sleep(1100)
      continue
    }

    const update = pickUpdates(r, geo)
    const fields = Object.keys(update)
    if (fields.length === 0) {
      stats.noChange++
      process.stderr.write(` — already complete\n`)
      await sleep(1100)
      continue
    }

    if (COMMIT) {
      const result = await patchMarket(r.id, update)
      if (!result.ok) {
        stats.writeFailed++
        process.stderr.write(` — write failed: ${result.error}\n`)
        await sleep(1100)
        continue
      }
    }
    stats.enriched++
    for (const k of fields) stats.fields[k] = (stats.fields[k] ?? 0) + 1
    process.stderr.write(` — ${fields.join(', ')}${COMMIT ? '' : ' (dry)'}\n`)
    await sleep(1100)
  }

  console.log()
  console.log('Summary:')
  console.log(`  Processed:      ${stats.processed}`)
  console.log(`  Enriched:       ${stats.enriched}`)
  console.log(`  Already done:   ${stats.noChange}`)
  console.log(`  Geocode failed: ${stats.geocodeFailed}`)
  console.log(`  Write failed:   ${stats.writeFailed}`)
  console.log()
  console.log('Fields filled:')
  for (const [k, v] of Object.entries(stats.fields)) {
    if (v > 0) console.log(`  ${k.padEnd(14)} ${v}`)
  }
  if (!COMMIT) {
    console.log()
    console.log('Dry-run only. Re-run with --commit to actually write.')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
