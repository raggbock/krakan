#!/usr/bin/env node
/**
 * Scrape PMU Second Hand stores from pmu.se and write them in the
 * @fyndstigen/shared/contracts/admin-business-import format.
 *
 *   node scripts/fetch-pmu.mjs supabase/seed/pmu.json
 *   node scripts/bulk-import-markets.mjs supabase/seed/pmu.json
 *
 * Strategy mirrors the Erikshjälpen / Myrorna scrapers:
 *   1. Read pmu.se/sitemap.xml; collect every /butik/<name>/ URL.
 *   2. Fetch each store page; extract address, phone, email, social, and
 *      opening hours. PMU pages often list two sets of hours — Butik (the
 *      store) and Gåvomottagning (donation drop-off) — we keep only the
 *      first set, which is the store itself.
 *   3. Geocode via Nominatim (1 req/s) for lat/lng + region/municipality.
 *
 * Idempotent: bulk-import-markets.mjs skips slugs that already exist.
 */

import { writeFileSync } from 'node:fs'

const OUTPUT_PATH = process.argv[2] ?? null
const SITEMAP_URL = 'https://pmu.se/sitemap.xml'
const STORE_URL_RE = /^https:\/\/pmu\.se\/butik\/[a-z0-9-]+\/?$/i
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

async function fetchSitemapUrls() {
  const xml = await fetchText(SITEMAP_URL)
  const urls = []
  const re = /<loc>\s*([^<]+)\s*<\/loc>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].trim()
    if (STORE_URL_RE.test(u)) urls.push(u)
  }
  return urls
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

// PMU address: "Blockgatan 29, 65341 Karlstad" — postal code is 5 digits,
// possibly without space.
const ADDRESS_RE = /([A-ZÅÄÖ][^,<>\n]{2,80}?\s+\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?),\s*(\d{3}\s*\d{2}|\d{5})\s+([A-ZÅÄÖa-zåäö][\wåäöÅÄÖ\s\-]+?)(?:[,<\s]|$)/

function extractAddress(html) {
  const text = plainText(html)
  const m = ADDRESS_RE.exec(text)
  if (!m) return null
  const postal = m[2].length === 5 && !m[2].includes(' ')
    ? `${m[2].slice(0, 3)} ${m[2].slice(3)}`
    : m[2].replace(/\s+/, ' ')
  return {
    street: m[1].trim(),
    postalCode: postal,
    locality: m[3].trim(),
  }
}

function extractEmail(html) {
  const m = /mailto:([\w.+-]+@[\w.-]+\.[a-z]{2,})/i.exec(html)
  return m ? m[1].toLowerCase() : null
}

function extractPhone(html) {
  const m = /href=["']tel:([+\d\s\-()]+)["']/i.exec(html)
  if (!m) {
    // Fallback: PMU sometimes only renders the number as plain text. Look
    // for a Swedish landline pattern near the word "Telefon" or similar.
    const idx = html.toLowerCase().indexOf('telefon')
    if (idx < 0) return null
    const slice = plainText(html.slice(idx, idx + 200))
    const f = /(\d{2,4}[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{0,3})/.exec(slice)
    if (!f) return null
    const raw = f[1].trim()
    let digits = raw.replace(/[^\d]/g, '')
    if (digits.startsWith('0')) digits = '+46' + digits.slice(1)
    if (!digits.startsWith('+')) digits = '+46' + digits
    return { phone: digits, phoneRaw: raw }
  }
  const raw = m[1].trim()
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = '+' + digits.slice(2)
  if (digits.startsWith('0')) digits = '+46' + digits.slice(1)
  if (!digits.startsWith('+')) digits = '+46' + digits
  return { phone: digits, phoneRaw: raw }
}

function extractSocial(html) {
  const fb = /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i.exec(html)
  const ig = /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i.exec(html)
  return {
    facebook: fb ? fb[0].replace(/[)>'"]+$/, '').replace(/\/$/, '') : null,
    instagram: ig ? ig[0].replace(/[)>'"]+$/, '').replace(/\/$/, '') : null,
  }
}

// PMU hours: "Tisdag 10-18" or "Tisdag 10:00-18:00". Also handle dot style.
const HOUR_LINE_RE = /(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(stängt|stangt|\d{1,2}(?:[.:]\d{2})?\s*[-–]\s*\d{1,2}(?:[.:]\d{2})?)/gi

function normTime(t) {
  const m = /(\d{1,2})(?:[.:](\d{2}))?/.exec(t)
  if (!m) return null
  const h = String(Number(m[1])).padStart(2, '0')
  const min = m[2] ?? '00'
  return `${h}:${min}`
}

function extractOpeningHours(html) {
  // PMU pages often have two day-list sections (Butik + Gåvomottagning).
  // Take the first occurrence per weekday — Butik is listed first.
  const text = plainText(html).toLowerCase()
  // Slice off everything from the gåvomottagning heading onward (if present)
  // so donation hours don't overwrite store hours.
  const cutIdx = text.indexOf('gåvomottagning')
  const slice = cutIdx >= 0 ? text.slice(0, cutIdx) : text
  const regular = []
  const seen = new Set()
  let m
  HOUR_LINE_RE.lastIndex = 0
  while ((m = HOUR_LINE_RE.exec(slice)) !== null) {
    const day = DAY_MAP[m[1].toLowerCase()]
    if (!day || seen.has(day)) continue
    const value = m[2].trim()
    if (/^stängt|^stangt/.test(value)) { seen.add(day); continue }
    const range = /(\d{1,2}(?:[.:]\d{2})?)\s*[-–]\s*(\d{1,2}(?:[.:]\d{2})?)/.exec(value)
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

function nameFromUrl(url) {
  const m = /\/butik\/([^/]+)\/?$/.exec(url)
  if (!m) return null
  const key = m[1]
  return key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function scrapeStore(url) {
  let html
  try { html = await fetchText(url) }
  catch (e) { return { ok: false, url, error: e.message } }

  const addr = extractAddress(html)
  if (!addr) return { ok: false, url, error: 'no address parsed' }

  const phone = extractPhone(html)
  const email = extractEmail(html)
  const social = extractSocial(html)
  const openingHours = extractOpeningHours(html)
  const cityLabel = nameFromUrl(url) ?? addr.locality

  const slugKey = url.replace(/^.*\/butik\//, '').replace(/\/$/, '')
  const slug = `pmu-${slugify(slugKey)}`
  const name = `PMU Second Hand ${cityLabel}`

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
      source: 'pmu.se',
    },
  }
}

async function main() {
  console.error('Fetching sitemap…')
  const urls = await fetchSitemapUrls()
  console.error(`Found ${urls.length} store URLs.`)

  const businesses = []
  const errors = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    process.stderr.write(`  [${i + 1}/${urls.length}] ${url}\n`)
    const result = await scrapeStore(url)
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
