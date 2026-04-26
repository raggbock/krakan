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
import {
  slugify, haversineKm, sleep, decodeHtml,
  extractEmailFromMailto, extractPhoneFromTelHref,
  normalizeTime, fetchSitemapUrls, nominatimGeocode, ÖREBRO,
} from './lib/scrape-helpers.mjs'

const OUTPUT_PATH = process.argv[2] ?? null

const SITEMAP_URL = 'https://erikshjalpen.se/stores-post-type-sitemap.xml'
const STORE_URL_RE = /^https:\/\/erikshjalpen\.se\/butiker\/[a-z0-9-]+\/?$/i
const USER_AGENT = 'Fyndstigen/1.0 (sebastian.myrdahl@gmail.com)'

const DAY_MAP = {
  måndag: 'monday', mandag: 'monday',
  tisdag: 'tuesday',
  onsdag: 'wednesday',
  torsdag: 'thursday',
  fredag: 'friday',
  lördag: 'saturday', lordag: 'saturday',
  söndag: 'sunday', sondag: 'sunday',
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
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
    const opens = normalizeTime(range[1])
    const closes = normalizeTime(range[2])
    if (opens && closes) {
      regular.push({ day, opens, closes })
      seen.add(day)
    }
  }
  return regular.length ? { regular } : null
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

  const phone = extractPhoneFromTelHref(html)
  const email = extractEmailFromMailto(html)
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
  const urls = await fetchSitemapUrls(SITEMAP_URL, { userAgent: USER_AGENT, filter: STORE_URL_RE })
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
    const g = await nominatimGeocode(q, { userAgent: USER_AGENT })
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
