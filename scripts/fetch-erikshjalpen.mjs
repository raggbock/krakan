#!/usr/bin/env node
/**
 * Scrape Erikshjälpen Second Hand stores from erikshjalpen.se and write
 * them in the @fyndstigen/shared/contracts/admin-business-import format.
 *
 *   node scripts/fetch-erikshjalpen.mjs > supabase/seed/erikshjalpen.json
 *
 * Then `node scripts/bulk-import-markets.mjs supabase/seed/erikshjalpen.json`
 * to load them as is_system_owned=true, published_at=NULL.
 *
 * Strategy:
 *   1. Pull the stores sitemap to enumerate all store URLs.
 *   2. For each store, fetch the page HTML and extract address, phone,
 *      email, opening hours, social links.
 *   3. Geocode the address via Nominatim (rate-limited 1 req/s) to fill
 *      lat/lng + region/municipality.
 *
 * Idempotent: bulk-import-markets.mjs skips slugs that already exist, so
 * re-running this is safe.
 */

import { writeFileSync } from 'node:fs'

const OUTPUT_PATH = process.argv[2] ?? null

const SITEMAP_URL = 'https://erikshjalpen.se/stores-post-type-sitemap.xml'
const STORE_URL_RE = /^https:\/\/erikshjalpen\.se\/butiker\/[a-z0-9-]+\/?$/i
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
    if (STORE_URL_RE.test(u) && !u.endsWith('/butiker/')) urls.push(u)
  }
  return urls
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&aring;/g, 'å').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö')
    .replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripTags(s) {
  return decodeHtml(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// Address line looks like: "Åbyvägen 1, 702 27 Örebro, Sverige"
const ADDRESS_RE = /([A-ZÅÄÖ][^,<>\n]{2,80}?\s+\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?),\s*(\d{3}\s*\d{2})\s+([A-ZÅÄÖa-zåäö][\wåäöÅÄÖ\s\-]+?),\s*Sverige/

function extractAddress(html) {
  const text = decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
  const m = ADDRESS_RE.exec(text)
  if (!m) return null
  return {
    street: m[1].trim(),
    postalCode: m[2].replace(/\s/g, ' '),
    locality: m[3].trim(),
  }
}

function extractEmail(html) {
  const m = /mailto:([\w.+-]+@[\w.-]+\.[a-z]{2,})/i.exec(html)
  return m ? m[1].toLowerCase() : null
}

function extractPhone(html) {
  // tel: hrefs are most reliable
  const m = /href=["']tel:([+\d\s\-()]+)["']/i.exec(html)
  if (!m) return null
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
  const cleanFb = fb ? fb[0].replace(/[)>'"]+$/, '').replace(/\/$/, '') : null
  const cleanIg = ig ? ig[0].replace(/[)>'"]+$/, '').replace(/\/$/, '') : null
  // Skip the corporate erikshjalpen accounts that show up in the footer.
  return {
    facebook: cleanFb && !/Erikshjalpen\/?$/i.test(cleanFb) ? cleanFb : null,
    instagram: cleanIg && !/(?:erikshjalpen|erikshjalpensh)\/?$/i.test(cleanIg) ? cleanIg : null,
  }
}

// Opening hours block. Erikshjälpen pages list each weekday with its
// open/close times in plain text, e.g. "Måndag: Stängt", "Tisdag: 11:00 – 18:00".
const HOUR_LINE_RE = /(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s*[:\-–]\s*(stängt|stangt|\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})/gi

function normTime(t) {
  const m = /(\d{1,2})[.:](\d{2})/.exec(t)
  if (!m) return null
  const h = String(Number(m[1])).padStart(2, '0')
  return `${h}:${m[2]}`
}

function extractOpeningHours(html) {
  const text = decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toLowerCase()
  const regular = []
  const seen = new Set()
  let m
  HOUR_LINE_RE.lastIndex = 0
  while ((m = HOUR_LINE_RE.exec(text)) !== null) {
    const day = DAY_MAP[m[1].toLowerCase()]
    if (!day || seen.has(day)) continue
    const value = m[2].trim()
    if (/^stängt|^stangt/.test(value)) {
      seen.add(day)
      continue
    }
    const range = /(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})/.exec(value)
    if (!range) continue
    const opens = normTime(range[1])
    const closes = normTime(range[2])
    if (opens && closes) {
      regular.push({ day, opens, closes })
      seen.add(day)
    }
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
    locality: r.address?.city || r.address?.town || r.address?.village || r.address?.suburb || null,
  }
}

function nameFromUrl(url) {
  const slug = url.replace(/^.*\/butiker\//, '').replace(/\/$/, '')
  return slug
    .replace(/^second-hand-/, '')
    .replace(/^m-and-e-second-hand-/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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
  const cityLabel = nameFromUrl(url)

  const slug = `erikshjalpen-${slugify(url.replace(/^.*\/butiker\//, '').replace(/\/$/, ''))}`
  const name = `Erikshjälpen Second Hand ${cityLabel}`

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
        municipality: addr.locality, // refined later via geocode
        region: 'Sverige',
        country: 'Sverige',
      },
      geo: null, // filled by geocode pass
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
      source: 'erikshjalpen.se',
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
    await sleep(250) // gentle on their CDN
  }

  console.error()
  console.error(`Scraped ${businesses.length} stores, ${errors.length} errors.`)
  if (errors.length) {
    for (const e of errors) console.error(`  ${e.url}: ${e.error}`)
  }

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
    await sleep(1100) // Nominatim policy: max 1 req/s
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
