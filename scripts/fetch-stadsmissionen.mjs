#!/usr/bin/env node
/**
 * Scrape Stockholms Stadsmission second-hand stores from stadsmissionen.se
 * and write them in the @fyndstigen/shared/contracts/admin-business-import
 * format.
 *
 *   node scripts/fetch-stadsmissionen.mjs supabase/seed/stadsmissionen.json
 *   node scripts/bulk-import-markets.mjs supabase/seed/stadsmissionen.json
 *
 * Strategy:
 *   1. Fetch /second-hand/hitta-butik; extract every /butiker/second-hand-<slug>
 *      link (skips matmissionen / mötesplats which aren't second-hand).
 *   2. Fetch each store page; extract address, phone, email, social, and
 *      per-day opening hours.
 *   3. Geocode via Nominatim (1 req/s) for lat/lng + region/municipality.
 *
 * Idempotent: bulk-import-markets.mjs skips slugs that already exist.
 */

import { writeFileSync } from 'node:fs'

const OUTPUT_PATH = process.argv[2] ?? null
const ROOT = 'https://www.stadsmissionen.se'
const LISTING_URL = `${ROOT}/second-hand/hitta-butik`
const STORE_PATH_RE = /\/butiker\/second-hand-[a-z0-9-]+/gi
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Fyndstigen/1.0 (sebastian.myrdahl@gmail.com)'
const ÖREBRO = { lat: 59.2741, lng: 15.2066 }

const DAY_MAP = {
  måndag: 'monday', mandag: 'monday',
  tisdag: 'tuesday',
  onsdag: 'wednesday',
  torsdag: 'thursday',
  fredag: 'friday',
  lördag: 'saturday', lordag: 'saturday',
  söndag: 'sunday', sondag: 'sunday',
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

async function fetchStorePaths() {
  const html = await fetchText(LISTING_URL)
  const set = new Set()
  let m
  STORE_PATH_RE.lastIndex = 0
  while ((m = STORE_PATH_RE.exec(html)) !== null) set.add(m[0])
  return [...set]
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aring;/g, 'å').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö')
    .replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function plainText(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
}

const ADDRESS_RE = /([A-ZÅÄÖ][^,<>\n]{2,80}?\s+\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?),\s*(\d{3}\s*\d{2})\s+([A-ZÅÄÖa-zåäö][\wåäöÅÄÖ\s\-]+?)(?:[,<\s]|$)/

function extractAddress(html) {
  const text = plainText(html)
  const m = ADDRESS_RE.exec(text)
  if (!m) return null
  return {
    street: m[1].trim(),
    postalCode: m[2].replace(/\s+/, ' '),
    locality: m[3].trim(),
  }
}

function extractEmail(html) {
  const m = /mailto:([\w.+-]+@[\w.-]+\.[a-z]{2,})/i.exec(html)
  return m ? m[1].toLowerCase() : null
}

function extractPhone(html) {
  const m = /href=["']tel:([+\d\s\-()]+)["']/i.exec(html)
  if (!m) return null
  const raw = m[1].trim()
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = '+' + digits.slice(2)
  if (digits.startsWith('0')) digits = '+46' + digits.slice(1)
  if (!digits.startsWith('+')) digits = '+46' + digits
  return { phone: digits, phoneRaw: raw }
}

// Stadsmissionen pages link to corporate Facebook/Instagram in the footer.
// Per-store accounts are rare — skip the corporate ones to avoid noise.
function extractSocial(html) {
  const fb = [...html.matchAll(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi)].map((m) => m[0])
  const ig = [...html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi)].map((m) => m[0])
  const cleanup = (u) => u.replace(/[)>'"]+$/, '').replace(/\/$/, '')
  const isCorpFb = (u) => /\/(Stadsmissionen|stockholmsstadsmission)\/?$/i.test(u)
  const isCorpIg = (u) => /\/(stockholmsstadsmission|stadsmissionen)\/?$/i.test(u)
  return {
    facebook: fb.map(cleanup).find((u) => !isCorpFb(u)) ?? null,
    instagram: ig.map(cleanup).find((u) => !isCorpIg(u)) ?? null,
  }
}

const HOUR_LINE_RE = /(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s*[:\-–]?\s*(stängt|stangt|\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})/gi

function normTime(t) {
  const m = /(\d{1,2})[.:](\d{2})/.exec(t)
  if (!m) return null
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

function extractOpeningHours(html) {
  const text = plainText(html).toLowerCase()
  const regular = []
  const seen = new Set()
  let m
  HOUR_LINE_RE.lastIndex = 0
  while ((m = HOUR_LINE_RE.exec(text)) !== null) {
    const day = DAY_MAP[m[1].toLowerCase()]
    if (!day || seen.has(day)) continue
    const value = m[2].trim()
    if (/^stängt|^stangt/.test(value)) { seen.add(day); continue }
    const range = /(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})/.exec(value)
    if (!range) continue
    const opens = normTime(range[1])
    const closes = normTime(range[2])
    if (opens && closes) { regular.push({ day, opens, closes }); seen.add(day) }
  }
  return regular.length ? { regular } : null
}

async function geocode(query) {
  const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'sv' } })
  if (!res.ok) return null
  const arr = await res.json()
  if (!arr.length) return null
  const r = arr[0]
  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    region: r.address?.state || r.address?.county || null,
    municipality: r.address?.municipality || r.address?.city_district || r.address?.city || r.address?.town || r.address?.village || null,
  }
}

function nameFromPath(path) {
  const m = /\/butiker\/second-hand-(.+)$/.exec(path)
  if (!m) return null
  return m[1].split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function scrapeStore(path) {
  const url = `${ROOT}${path}`
  let html
  try { html = await fetchText(url) }
  catch (e) { return { ok: false, url, error: e.message } }

  const addr = extractAddress(html)
  if (!addr) return { ok: false, url, error: 'no address parsed' }

  const phone = extractPhone(html)
  const email = extractEmail(html)
  const social = extractSocial(html)
  const openingHours = extractOpeningHours(html)
  const label = nameFromPath(path) ?? addr.locality

  const slugKey = path.replace(/^\/butiker\//, '')
  const slug = `stadsmissionen-${slugify(slugKey)}`
  const name = `Stockholms Stadsmission Second Hand ${label}`

  return {
    ok: true,
    url,
    business: {
      slug,
      name,
      category: 'Kyrklig-bistånd',
      description: null,
      address: {
        street: addr.street,
        postalCode: addr.postalCode,
        locality: addr.locality,
        municipality: addr.locality,
        region: 'Sverige',
        country: 'Sverige',
      },
      geo: null,
      contact: {
        phone: phone?.phone ?? null,
        phoneRaw: phone?.phoneRaw ?? null,
        email,
        website: url,
        facebook: social.facebook,
        instagram: social.instagram,
      },
      openingHours,
      distanceFromOrebroKm: null,
      status: 'unverified',
      takeover: { shouldSendEmail: false, priority: 2 },
      notes: null,
      source: 'stadsmissionen.se',
    },
  }
}

async function main() {
  console.error('Fetching listing page…')
  const paths = await fetchStorePaths()
  console.error(`Found ${paths.length} store paths.`)

  const businesses = []
  const errors = []
  for (let i = 0; i < paths.length; i++) {
    process.stderr.write(`  [${i + 1}/${paths.length}] ${paths[i]}\n`)
    const result = await scrapeStore(paths[i])
    if (!result.ok) { errors.push(result); continue }
    businesses.push(result.business)
    await sleep(250)
  }

  console.error()
  console.error(`Scraped ${businesses.length} stores, ${errors.length} errors.`)
  for (const e of errors) console.error(`  ${e.url}: ${e.error}`)

  console.error()
  console.error('Geocoding via Nominatim (1 req/s)…')
  for (let i = 0; i < businesses.length; i++) {
    const b = businesses[i]
    const q = `${b.address.street}, ${b.address.postalCode} ${b.address.locality}, Sverige`
    const g = await geocode(q)
    if (g) {
      b.geo = { lat: g.lat, lng: g.lng, precision: 'address', source: 'nominatim' }
      b.address.municipality = g.municipality ?? b.address.locality
      b.address.region = g.region ?? 'Sverige'
      b.distanceFromOrebroKm = haversineKm(ÖREBRO, { lat: g.lat, lng: g.lng })
      process.stderr.write(`  [${i + 1}/${businesses.length}] ${b.name} — ${g.lat},${g.lng}\n`)
    } else {
      process.stderr.write(`  [${i + 1}/${businesses.length}] ${b.name} — NO GEOCODE\n`)
    }
    await sleep(1100)
  }

  const out = { businesses }
  const json = JSON.stringify(out, null, 2)
  if (OUTPUT_PATH) {
    writeFileSync(OUTPUT_PATH, json, 'utf8')
    console.error(`Done. Wrote ${businesses.length} businesses to ${OUTPUT_PATH}`)
  } else {
    process.stdout.write(json)
    console.error()
    console.error(`Done. Wrote ${businesses.length} businesses.`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
