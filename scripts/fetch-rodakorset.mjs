#!/usr/bin/env node
/**
 * Scrape Röda Korset Kupan / Second Hand stores from rodakorset.se and
 * write them in the @fyndstigen/shared/contracts/admin-business-import
 * format.
 *
 *   node scripts/fetch-rodakorset.mjs supabase/seed/rodakorset.json
 *   node scripts/bulk-import-markets.mjs supabase/seed/rodakorset.json
 *
 * Strategy:
 *   1. Pull rodakorset.se/sitemap.xml; keep entries under /second-hand/.
 *   2. Fetch each store page; extract address (street only — no postcode in
 *      page text), phone, email, social, opening hours (the grouped format
 *      "Måndag-Fredag / 11:00-18:00" needs range expansion), and lat/lng
 *      from the embedded Google Maps URL (rodakorset puts coordinates
 *      directly in the page — no Nominatim needed).
 *   3. URL path encodes region + municipality:
 *        /ort/<region>/<municipality>-kommun/second-hand/<slug>/
 *      so we read those directly.
 *
 * Idempotent: bulk-import-markets.mjs skips slugs that already exist.
 */

import { writeFileSync } from 'node:fs'

const OUTPUT_PATH = process.argv[2] ?? null
const SITEMAP_URL = 'https://www.rodakorset.se/sitemap.xml'
const STORE_URL_RE = /^https:\/\/www\.rodakorset\.se\/ort\/[^/]+\/[^/]+-kommun\/second-hand\/[^/]+\/?$/i
const USER_AGENT = 'Fyndstigen/1.0 (sebastian.myrdahl@gmail.com)'
const ÖREBRO = { lat: 59.2741, lng: 15.2066 }

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_MAP = {
  måndag: 'monday', mandag: 'monday', mån: 'monday', man: 'monday',
  tisdag: 'tuesday', tis: 'tuesday',
  onsdag: 'wednesday', ons: 'wednesday',
  torsdag: 'thursday', tor: 'thursday', tors: 'thursday',
  fredag: 'friday', fre: 'friday',
  lördag: 'saturday', lordag: 'saturday', lör: 'saturday', lor: 'saturday',
  söndag: 'sunday', sondag: 'sunday', sön: 'sunday', son: 'sunday',
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

function titleCase(s) {
  return s.split(/[-\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
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
  return decodeHtml(html.replace(/<[^>]+>/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n'))
}

// rodakorset embeds an Apple/Google Maps URL with literal coordinates.
function extractLatLng(html) {
  const g = /maps\/search\/\?api=1&(?:amp;)?query=(-?\d+\.\d+),(-?\d+\.\d+)/i.exec(html)
  if (g) return { lat: parseFloat(g[1]), lng: parseFloat(g[2]) }
  const a = /maps\.apple\.com\/[^"'<>]*?ll=(-?\d+\.\d+),(-?\d+\.\d+)/i.exec(html)
  if (a) return { lat: parseFloat(a[1]), lng: parseFloat(a[2]) }
  return null
}

// Address: just street + number on the page. Locality comes from URL.
const STREET_RE = /([A-ZÅÄÖ][\wåäöÅÄÖ.\-\s]{2,60}?\s+\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?)/

function extractStreet(html) {
  // Prefer text near an "Adress" or "Besöksadress" heading.
  for (const heading of ['besöksadress', 'adress', 'gatuadress']) {
    const idx = html.toLowerCase().indexOf(heading)
    if (idx < 0) continue
    const slice = plainText(html.slice(idx, idx + 400))
    const m = STREET_RE.exec(slice.split('\n').slice(1, 6).join('\n'))
    if (m) return m[1].trim()
  }
  return null
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

function extractSocial(html) {
  const fb = [...html.matchAll(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi)].map((m) => m[0])
  const ig = [...html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi)].map((m) => m[0])
  const cleanup = (u) => u.replace(/[)>'"]+$/, '').replace(/\/$/, '')
  // Skip the corporate Röda Korset page; keep the per-store ones.
  const isCorporateFb = (u) => /\/Rodakorset\/?$/i.test(u) || /\/svenskarodakorset\/?$/i.test(u)
  return {
    facebook: fb.map(cleanup).find((u) => !isCorporateFb(u)) ?? null,
    instagram: ig.map(cleanup).find((u) => !/\/svenskarodakorset\/?$/i.test(u)) ?? null,
  }
}

function expandDayRange(fromDay, toDay) {
  const a = DAY_ORDER.indexOf(fromDay)
  const b = DAY_ORDER.indexOf(toDay)
  if (a < 0 || b < 0 || a > b) return [fromDay]
  return DAY_ORDER.slice(a, b + 1)
}

function normTime(t) {
  const m = /(\d{1,2})(?:[.:](\d{2}))?/.exec(t)
  if (!m) return null
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2] ?? '00'}`
}

const DAY_TOKEN = '(måndag|mandag|tisdag|onsdag|torsdag|fredag|lördag|lordag|söndag|sondag|mån|man|tis|ons|tor|tors|fre|lör|lor|sön|son)'
const DAY_RANGE_RE = new RegExp(`${DAY_TOKEN}\\s*[-–]\\s*${DAY_TOKEN}|${DAY_TOKEN}`, 'gi')
const TIME_RANGE_RE = /(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})|stängt|stangt/i

function extractOpeningHours(html) {
  // rodakorset emits each day/range and time on separate <p> or <div>
  // elements, so plainText() with newlines makes pairing trivial.
  const idx = html.toLowerCase().indexOf('öppettider')
  if (idx < 0) return null
  const slice = plainText(html.slice(idx, idx + 800))
  const lines = slice.split('\n').map((l) => l.trim()).filter(Boolean)

  const regular = []
  const seen = new Set()
  for (let i = 0; i < lines.length - 1; i++) {
    const dayLine = lines[i].toLowerCase()
    const timeLine = lines[i + 1].toLowerCase()
    DAY_RANGE_RE.lastIndex = 0
    const dm = DAY_RANGE_RE.exec(dayLine)
    if (!dm) continue
    const tm = TIME_RANGE_RE.exec(timeLine)
    if (!tm) continue

    let days
    if (dm[1] && dm[2]) {
      const from = DAY_MAP[dm[1].toLowerCase()]
      const to = DAY_MAP[dm[2].toLowerCase()]
      if (!from || !to) continue
      days = expandDayRange(from, to)
    } else if (dm[3]) {
      const single = DAY_MAP[dm[3].toLowerCase()]
      if (!single) continue
      days = [single]
    } else continue

    if (/stängt|stangt/.test(timeLine)) {
      for (const d of days) seen.add(d)
      i += 1
      continue
    }
    const opens = normTime(tm[1])
    const closes = normTime(tm[2])
    if (!opens || !closes) continue
    for (const d of days) {
      if (seen.has(d)) continue
      regular.push({ day: d, opens, closes })
      seen.add(d)
    }
    i += 1 // consume the time line too
  }
  return regular.length ? { regular } : null
}

function parseUrlParts(url) {
  const m = /\/ort\/([^/]+)\/([^/]+)-kommun\/second-hand\/([^/]+)\/?$/.exec(url)
  if (!m) return null
  return {
    region: titleCase(m[1]),
    municipality: titleCase(m[2]),
    storeKey: m[3],
  }
}

async function scrapeStore(url) {
  let html
  try { html = await fetchText(url) }
  catch (e) { return { ok: false, url, error: e.message } }

  const parts = parseUrlParts(url)
  if (!parts) return { ok: false, url, error: 'cannot parse url' }

  const street = extractStreet(html)
  const phone = extractPhone(html)
  const email = extractEmail(html)
  const social = extractSocial(html)
  const openingHours = extractOpeningHours(html)
  const latLng = extractLatLng(html)

  // Title comes from URL slug: "roda-korset-second-hand-orebro-rudbecksgatan"
  // → drop the chain prefix, title-case the rest for a readable name.
  const cleanedKey = parts.storeKey
    .replace(/^roda-korset-second-hand-/, '')
    .replace(/^motesplats-kupan-roda-korset-/, '')
    .replace(/^kupan-roda-korset-/, '')
    .replace(/^roda-korset-/, '')
  const label = titleCase(cleanedKey) || parts.municipality
  const slug = `rodakorset-${slugify(parts.storeKey)}`
  const name = `Röda Korset Second Hand ${label}`

  return {
    ok: true,
    url,
    business: {
      slug,
      name,
      category: 'Kyrklig-bistånd',
      description: null,
      address: {
        street: street ?? null,
        postalCode: null,
        locality: parts.municipality,
        municipality: parts.municipality,
        region: parts.region,
        country: 'Sverige',
      },
      geo: latLng ? { lat: latLng.lat, lng: latLng.lng, precision: 'address', source: 'rodakorset.se' } : null,
      contact: {
        phone: phone?.phone ?? null,
        phoneRaw: phone?.phoneRaw ?? null,
        email,
        website: url,
        facebook: social.facebook,
        instagram: social.instagram,
      },
      openingHours,
      distanceFromOrebroKm: latLng ? haversineKm(ÖREBRO, latLng) : null,
      status: 'unverified',
      takeover: { shouldSendEmail: false, priority: 2 },
      notes: null,
      source: 'rodakorset.se',
    },
  }
}

async function main() {
  console.error('Fetching sitemap…')
  const urls = await fetchSitemapUrls()
  console.error(`Found ${urls.length} second-hand URLs.`)

  const businesses = []
  const errors = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    process.stderr.write(`  [${i + 1}/${urls.length}] ${url}\n`)
    const result = await scrapeStore(url)
    if (!result.ok) { errors.push(result); continue }
    if (!result.business.address.street) {
      // Without a street we can't import — admin would need to fill it.
      errors.push({ ok: false, url, error: 'no street parsed' })
      continue
    }
    businesses.push(result.business)
    await sleep(250)
  }

  console.error()
  console.error(`Scraped ${businesses.length} stores, ${errors.length} errors.`)
  for (const e of errors) console.error(`  ${e.url}: ${e.error}`)

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
