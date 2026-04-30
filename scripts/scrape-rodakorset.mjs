#!/usr/bin/env node
/**
 * scrape-rodakorset.mjs
 *
 * Scrapes ALL Röda Korset second-hand stores from rodakorset.se and
 * either dumps a review JSON (default) or applies them to Supabase
 * (--apply). Modeled on enrich-opening-hours.mjs.
 *
 * Phase 1 (default):
 *   - Walks the paginated listing /second-hand/butiker?p=N&s=10 (26 pages)
 *   - For each store, fetches the detail page
 *   - Extracts: street, zip, city, phone, opening hours
 *   - Writes scripts/rodakorset-found.json + scripts/rodakorset-failed.json
 *
 * Phase 2 (--apply):
 *   - Reads found.json
 *   - Matches by street+city against existing flea_markets (case-insensitive)
 *   - Updates matched markets, inserts new ones (system-owned, published)
 *   - Replaces opening_hour_rules
 *
 * Run:
 *   node scripts/scrape-rodakorset.mjs              # phase 1
 *   node scripts/scrape-rodakorset.mjs --apply      # phase 2
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  plainText, plainTextLines,
  normalizePhone, extractPhoneFromTelHref, extractEmailFromMailto, sleep,
} from './lib/scrape-helpers.mjs'
import { parseOpeningHours, extractCandidateText } from './lib/opening-hours-parser.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FOUND_PATH = join(here, 'rodakorset-found.json')
const FAILED_PATH = join(here, 'rodakorset-failed.json')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')

const SYSTEM_ORGANIZER_ID = 'f1d57000-1000-4000-8000-000000000001'
const BASE = 'https://www.rodakorset.se'
const LISTING = `${BASE}/second-hand/butiker`

const UA = 'Fyndstigen/1.0 (+https://fyndstigen.se)'
const RATE_LIMIT_MS = 400

async function fetchHtml(url) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 15_000)
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Phase 1: scrape the listing + each detail page
// ---------------------------------------------------------------------------

/**
 * Extract store URLs from a listing page. Pattern:
 *   /ort/{region}/{kommun}/second-hand/{slug}
 * Some entries are mötesplatser without /second-hand/ — keep only stores.
 */
function extractStoreUrls(html) {
  const urls = new Set()
  const re = /href=["'](\/ort\/[^"']+\/second-hand\/[^"']+)["']/g
  let m
  while ((m = re.exec(html)) != null) {
    const path = m[1].replace(/\/$/, '')
    // Filter out the kommun-level overview pages — those end at /second-hand
    // without a trailing slug. Real stores have /second-hand/<slug>.
    const seg = path.split('/').filter(Boolean)
    // Expected: ort, region, kommun, second-hand, slug → 5 segments
    if (seg.length >= 5) urls.add(BASE + path)
  }
  return [...urls]
}

async function collectAllStoreUrls() {
  const all = new Set()
  let page = 1
  while (true) {
    const url = `${LISTING}?p=${page}&s=10`
    process.stdout.write(`\r[listing] page ${page}…`)
    const html = await fetchHtml(url)
    const urls = extractStoreUrls(html)
    const before = all.size
    for (const u of urls) all.add(u)
    if (all.size === before) break // no new URLs → end of pagination
    page++
    await sleep(RATE_LIMIT_MS)
    if (page > 50) break // safety cap
  }
  process.stdout.write(`\n`)
  return [...all]
}

const SCHEMA_DAYS = {
  'https://schema.org/Sunday': 0, 'https://schema.org/Monday': 1,
  'https://schema.org/Tuesday': 2, 'https://schema.org/Wednesday': 3,
  'https://schema.org/Thursday': 4, 'https://schema.org/Friday': 5,
  'https://schema.org/Saturday': 6,
}

/**
 * Röda Korset detail pages embed a complete schema.org Store JSON-LD
 * with address, geo, opening hours, and telephone. Parse it directly —
 * far more reliable than scraping rendered text. Falls back to plaintext
 * regex only if the JSON-LD is missing.
 */
function parseStorePage(html, storeUrl) {
  // schema.org JSON-LD is rendered without a wrapping <script type="ld+json">
  // tag (it's inlined as a bare object literal in plaintext lines), but
  // we can still grab it by looking for the @type:"Store" signature.
  const ldMatch = /\{[^{]*"@type"\s*:\s*"Store"[\s\S]*?"priceRange"[\s\S]*?\}/.exec(html)
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[0])
      const addr = ld.address ?? {}
      const geo = ld.geo ?? {}
      const rules = (ld.openingHoursSpecification ?? [])
        .map((s) => {
          const dow = SCHEMA_DAYS[s.dayOfWeek]
          if (dow == null) return null
          return {
            day_of_week: dow,
            open_time: (s.opens || '').slice(0, 5),
            close_time: (s.closes || '').slice(0, 5),
          }
        })
        .filter((r) => r && r.open_time && r.close_time)
        .sort((a, b) => a.day_of_week - b.day_of_week)

      let zip = addr.postalCode ?? null
      if (zip && /^\d{5}$/.test(zip)) zip = `${zip.slice(0, 3)} ${zip.slice(3)}`

      return {
        name: ld.name ?? null,
        street: addr.streetAddress ?? null,
        city: addr.addressLocality ?? null,
        zip,
        phone: ld.telephone ? normalizePhone(ld.telephone) : null,
        email: ld.email ?? extractEmailFromMailto(html),
        latitude: geo.latitude ? parseFloat(geo.latitude) : null,
        longitude: geo.longitude ? parseFloat(geo.longitude) : null,
        rules,
      }
    } catch {
      // fall through to plaintext fallback
    }
  }

  // Plaintext fallback — for pages without JSON-LD (mötesplatser, etc.)
  return parseStorePageFallback(html, storeUrl)
}

function parseStorePageFallback(html, storeUrl) {
  const text = plainTextLines(html).split('\n').map((l) => l.trim()).filter(Boolean)

  // Name from <h1>
  let name = null
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  if (h1) name = plainText(h1[1]).trim() || null

  // Phone from tel: href (may be missing)
  const phone = extractPhoneFromTelHref(html)?.phone ?? null

  // Coordinates from Google Maps query=lat,lng
  let latitude = null, longitude = null
  const geo = /google\.[^"']*\/maps\/[^"']*[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(html)
  if (geo) {
    latitude = parseFloat(geo[1])
    longitude = parseFloat(geo[2])
  }

  // Street: heuristic — scan for a short line near the top that ends with a
  // street suffix or contains a house number. Stop at the first match.
  // Limit to first ~80 lines so we don't grab unrelated street names from
  // article body text further down the page.
  const STREET_SUFFIX = /(vägen|gatan|gränd|torg|torget|plan|platsen|stigen|allén|backen|brogatan|kajen|kyrkogatan|gata)\s*\d|\d+\s*[A-Za-zåäö]?$/i
  let street = null
  for (let i = 0; i < Math.min(text.length, 80); i++) {
    const t = text[i]
    if (!t || t === name) continue
    if (t.length > 60) continue
    if (/^(visa|öppna|hitta|kontakt|map|google|apple|telefon|e-?post|öppettid|adress)/i.test(t)) continue
    // Must contain a digit (house number) AND look like an address
    if (/\d/.test(t) && (STREET_SUFFIX.test(t) || /^[A-ZÅÄÖ][\wåäöÅÄÖ\s.-]+\s+\d+/.test(t))) {
      street = t
      break
    }
  }

  // City from the URL path: /ort/{region}/{kommun}/second-hand/{slug}
  // Kommun slugs end in "-kommun" or "-stad" — strip and titlecase.
  let city = null
  const pathMatch = /\/ort\/[^/]+\/([^/]+)\/second-hand\//.exec(storeUrl)
  if (pathMatch) {
    const kommunSlug = pathMatch[1].replace(/-(kommun|stad|region)$/, '')
    city = kommunSlug
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
      .replace(/\bA\b/g, 'å').replace(/\bAa\b/g, 'Å')
  }

  // Breadcrumb fallback for city — last <a> in breadcrumbs before the H1
  // often contains the proper Swedish spelling (with diacritics)
  const breadcrumb = /<nav[^>]*breadcrumb[\s\S]*?<\/nav>/i.exec(html)
  if (breadcrumb) {
    const links = [...breadcrumb[0].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim())
    if (links.length > 0) city = links[links.length - 1] || city
  }

  // Hours
  const candText = extractCandidateText(html)
  const { rules } = parseOpeningHours(candText)

  return { name, street, city, zip: null, phone, latitude, longitude, rules }
}

async function scrape() {
  console.log('[phase 1] Collecting store URLs from listing pages…')
  const urls = await collectAllStoreUrls()
  console.log(`[phase 1] Found ${urls.length} store URLs`)

  const found = []
  const failed = []
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]
    const tag = `[${i + 1}/${urls.length}]`
    try {
      const html = await fetchHtml(u)
      const parsed = parseStorePage(html, u)
      if (!parsed.street || !parsed.city) {
        failed.push({ url: u, reason: 'missing_address', parsed })
        console.log(`${tag} ${u} — missing address`)
      } else if (parsed.rules.length === 0) {
        // Still useful to keep — admin can fill hours later
        found.push({ url: u, ...parsed, hours_missing: true })
        console.log(`${tag} ${parsed.name} (${parsed.city}) — no hours`)
      } else {
        found.push({ url: u, ...parsed })
        console.log(`${tag} ${parsed.name} (${parsed.city}) — ${parsed.rules.length} rules`)
      }
    } catch (e) {
      failed.push({ url: u, reason: e.message })
      console.log(`${tag} ${u} — FAILED: ${e.message}`)
    }
    await sleep(RATE_LIMIT_MS)
  }

  writeFileSync(FOUND_PATH, JSON.stringify(found, null, 2))
  writeFileSync(FAILED_PATH, JSON.stringify(failed, null, 2))
  console.log(`\nWrote ${found.length} → rodakorset-found.json`)
  console.log(`Wrote ${failed.length} → rodakorset-failed.json`)
}

// ---------------------------------------------------------------------------
// Phase 2: apply found.json to Supabase
// ---------------------------------------------------------------------------

function checkEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
    process.exit(1)
  }
  try {
    const payload = SERVICE_KEY.split('.')[1]
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const role = JSON.parse(json).role
    if (role !== 'service_role') {
      console.error(`SUPABASE_SERVICE_ROLE_KEY decodes as role="${role}" — must be "service_role".`)
      process.exit(1)
    }
  } catch {
    console.error('Could not decode SUPABASE_SERVICE_ROLE_KEY as JWT.')
    process.exit(1)
  }
}

const sbHeaders = () => ({
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
})

function normKey(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '')
}

function makeSlug(city, name) {
  const base = (name || city).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
  const citySlug = (city || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  if (base.includes(citySlug) || !citySlug) return base
  return `${base}-${citySlug}`.slice(0, 80)
}

async function fetchExistingRedCross() {
  const url = `${SUPABASE_URL}/rest/v1/flea_markets`
    + `?select=id,slug,name,street,city,is_deleted`
    + `&or=(name.ilike.*röda%20kors*,name.ilike.*roda%20kors*,slug.like.%25roda-korset%25,slug.like.%25svenska-roda-korset%25,name.ilike.*kupan*)`
    + `&is_deleted=eq.false`
  const res = await fetch(url, { headers: sbHeaders() })
  if (!res.ok) throw new Error(`Fetch existing: ${res.status} ${await res.text()}`)
  return res.json()
}

async function apply() {
  checkEnv()
  const found = JSON.parse(readFileSync(FOUND_PATH, 'utf8'))
  console.log(`Read ${found.length} entries from rodakorset-found.json`)

  const existing = await fetchExistingRedCross()
  console.log(`Loaded ${existing.length} existing Röda Korset markets in DB`)

  const byKey = new Map()
  for (const m of existing) {
    const k = `${normKey(m.street)}|${normKey(m.city)}`
    byKey.set(k, m)
  }

  let updated = 0, inserted = 0, skipped = 0, errors = 0

  for (const f of found) {
    try {
      const k = `${normKey(f.street)}|${normKey(f.city)}`
      const match = byKey.get(k)

      // latitude/longitude are GENERATED columns derived from `location`
      // (PostGIS geography). Must write coordinates via location WKT.
      const patch = {
        street: f.street,
        city: f.city,
        zip_code: f.zip,
        contact_phone: f.phone,
        contact_email: f.email ?? null,
        contact_website: f.url,
        ...(f.latitude && f.longitude
          ? { location: `POINT(${f.longitude} ${f.latitude})` }
          : {}),
      }

      let marketId
      if (match) {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${match.id}`,
          { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(patch) },
        )
        if (!res.ok) throw new Error(`Update ${match.slug}: ${res.status} ${await res.text()}`)
        marketId = match.id
        updated++
        console.log(`UPDATE ${match.slug} ← ${f.name} (${f.city})`)
      } else {
        const slug = makeSlug(f.city, f.name)
        const insert = {
          ...patch,
          name: f.name || `Röda Korset ${f.city}`,
          slug,
          country: 'Sweden',
          is_permanent: true,
          organizer_id: SYSTEM_ORGANIZER_ID,
          status: 'confirmed',
          is_system_owned: true,
          published_at: new Date().toISOString(),
        }
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/flea_markets`,
          { method: 'POST', headers: sbHeaders(), body: JSON.stringify(insert) },
        )
        if (!res.ok) {
          const body = await res.text()
          // slug collision → retry with -2 suffix
          if (res.status === 409 || body.includes('duplicate key')) {
            insert.slug = `${slug}-2`.slice(0, 80)
            const r2 = await fetch(
              `${SUPABASE_URL}/rest/v1/flea_markets`,
              { method: 'POST', headers: sbHeaders(), body: JSON.stringify(insert) },
            )
            if (!r2.ok) throw new Error(`Insert ${insert.slug}: ${r2.status} ${await r2.text()}`)
            const arr = await r2.json()
            marketId = arr[0].id
          } else {
            throw new Error(`Insert ${slug}: ${res.status} ${body}`)
          }
        } else {
          const arr = await res.json()
          marketId = arr[0].id
        }
        inserted++
        console.log(`INSERT ${insert.slug} ← ${f.name} (${f.city})`)
      }

      // Replace opening hours via atomic RPC
      if (f.rules && f.rules.length > 0) {
        const p_rules = f.rules.map((r) => ({
          type: 'weekly',
          day_of_week: r.day_of_week,
          anchor_date: null,
          open_time: `${r.open_time}:00`,
          close_time: `${r.close_time}:00`,
        }))
        const rpcRes = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/replace_opening_hours_atomic`,
          {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ p_market_id: marketId, p_rules }),
          },
        )
        if (!rpcRes.ok) throw new Error(`Rules ${marketId}: ${rpcRes.status} ${await rpcRes.text()}`)
      }
    } catch (e) {
      errors++
      console.error(`ERR ${f.url}: ${e.message}`)
    }
  }

  console.log(`\nUpdated ${updated}, inserted ${inserted}, skipped ${skipped}, errors ${errors}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (APPLY) {
  apply().catch((e) => { console.error(e); process.exit(1) })
} else {
  scrape().catch((e) => { console.error(e); process.exit(1) })
}
