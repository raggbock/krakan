#!/usr/bin/env node
/**
 * Fetch second-hand / charity / flea-market entries from OpenStreetMap (Sweden)
 * via the Overpass API and write them as a JSON file in the format the
 * /admin/import endpoint accepts.
 *
 * Run:
 *   node scripts/fetch-osm-flea-markets.mjs > supabase/seed/osm-flea-markets.json
 *
 * Then upload the file via /admin/import. Leave "Publicera direkt" OFF —
 * markets land as system-owned, status='unverified', unpublished. Admin
 * curates from /admin/markets.
 *
 * Tags we pull:
 *   shop=second_hand   — second-hand shops
 *   shop=charity       — charity shops (Erikshjälpen, Stadsmissionen, etc.)
 *   amenity=marketplace + flea_market=yes — outdoor flea markets
 *
 * The categorisation heuristic and the deduplication-by-coords keep the
 * output reasonably clean, but expect some manual curation in
 * /admin/markets — that's why every row is created with status:'unverified'.
 */

import { writeFileSync } from 'node:fs'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

const QUERY = `
[out:json][timeout:120];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  node["shop"="second_hand"](area.se);
  way["shop"="second_hand"](area.se);
  node["shop"="charity"](area.se);
  way["shop"="charity"](area.se);
  node["amenity"="marketplace"]["flea_market"="yes"](area.se);
  node["amenity"="marketplace"]["second_hand"="yes"](area.se);
);
out center tags;
`.trim()

const ÖREBRO = { lat: 59.2741, lng: 15.2066 }

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const CHURCH_KEYWORDS = ['erikshjälp', 'erikshjalp', 'stadsmission', 'frälsnings', 'pingstkyr', 'svenska kyrkan', 'kyrkan', 'församling', 'second-hand-kyrkan', 'human bridge', 'pmu', 'läkarmissionen', 'lakarmission']
const ANTIQUE_KEYWORDS = ['antik', 'retro', 'vintage', 'auktion']
const CHAIN_KEYWORDS = ['myrorna', 'emmaus', 'stadsmissionen', 'erikshjälpen']

function classifyCategory(tags, shopType) {
  const name = (tags.name ?? '').toLowerCase()
  if (shopType === 'charity') return 'Kyrklig-bistånd'
  if (CHURCH_KEYWORDS.some((k) => name.includes(k))) return 'Kyrklig-bistånd'
  if (CHAIN_KEYWORDS.some((k) => name.includes(k))) return 'Kedja'
  if (ANTIQUE_KEYWORDS.some((k) => name.includes(k))) return 'Antik-retro'
  if (tags.amenity === 'marketplace') return 'Evenemang'
  return 'Privat'
}

function normalizeUrl(raw) {
  if (!raw) return null
  const v = raw.trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

function normalizePhone(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/[\s()\-]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('0')) return `+46${cleaned.slice(1)}`
  return cleaned
}

function pickEmail(tags) {
  const v = tags.email ?? tags['contact:email']
  if (!v) return null
  const m = v.match(/[^\s,;]+@[^\s,;]+/)
  return m ? m[0].toLowerCase() : null
}

function municipalityFromTags(tags) {
  return tags['addr:municipality'] ?? tags['is_in:municipality'] ?? null
}

function regionFromTags(tags) {
  return tags['addr:state'] ?? tags['is_in:state'] ?? tags['addr:province'] ?? null
}

function toImportBusiness(el, seenSlugs) {
  const tags = el.tags ?? {}
  const name = (tags.name ?? '').trim()
  if (!name) return null

  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  const locality = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? tags['addr:suburb'] ?? null
  if (!locality) return null

  const baseSlug = slugify(`${name}-${locality}`) || slugify(name)
  if (!baseSlug) return null
  let slug = baseSlug
  let dedup = 1
  while (seenSlugs.has(slug)) {
    dedup++
    slug = `${baseSlug}-${dedup}`
  }
  seenSlugs.add(slug)

  const shopType = tags.shop ?? null
  const category = classifyCategory(tags, shopType)
  const distanceFromOrebroKm = haversineKm(ÖREBRO, { lat, lng })

  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || null
  const postalCode = tags['addr:postcode'] ?? null

  return {
    slug,
    name,
    category,
    description: tags.description ?? null,
    address: {
      street,
      postalCode,
      locality,
      municipality: municipalityFromTags(tags) ?? locality,
      region: regionFromTags(tags) ?? '',
      country: 'SE',
    },
    geo: {
      lat,
      lng,
      precision: street ? 'address' : 'locality',
      source: 'osm',
    },
    contact: {
      phone: normalizePhone(tags['contact:phone'] ?? tags.phone ?? null),
      phoneRaw: tags['contact:phone'] ?? tags.phone ?? null,
      email: pickEmail(tags),
      website: normalizeUrl(tags['contact:website'] ?? tags.website ?? null),
      facebook: normalizeUrl(tags['contact:facebook'] ?? null),
      instagram: normalizeUrl(tags['contact:instagram'] ?? null),
    },
    openingHours: null,           // opening_hours-tag is OSM-format, separate parser later
    distanceFromOrebroKm,
    status: 'unverified',
    takeover: {
      shouldSendEmail: false,     // never auto-send for OSM rows; admin opts in
      priority: 3,
    },
    notes: `osm:${el.type}/${el.id}`,
    source: 'osm-overpass',
  }
}

async function main() {
  process.stderr.write('Querying Overpass…\n')
  const body = new URLSearchParams({ data: QUERY }).toString()
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Fyndstigen/1.0 (+https://fyndstigen.se)',
    },
    body,
  })
  if (!res.ok) {
    process.stderr.write(`Overpass HTTP ${res.status}\n`)
    process.exit(1)
  }
  const data = await res.json()
  const elements = data.elements ?? []
  process.stderr.write(`Got ${elements.length} OSM elements\n`)

  // Region/municipality reverse-geocoding via Nominatim is rate-limited (1 req/s)
  // and we'd hit it 1000+ times — skip. Region stays empty for rows OSM doesn't
  // tag explicitly; admin can fill in from /admin/markets bulk-edit.
  const seenSlugs = new Set()
  const seenByCoord = new Set()
  const businesses = []
  let dropped = 0
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat != null && lng != null) {
      // Coord dedup — same building, multiple ways/nodes for the same shop.
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
      if (seenByCoord.has(key)) { dropped++; continue }
      seenByCoord.add(key)
    }
    const b = toImportBusiness(el, seenSlugs)
    if (b) businesses.push(b)
    else dropped++
  }

  process.stderr.write(`Kept ${businesses.length}, dropped ${dropped} (no name / no coord / no city / dup-coord)\n`)

  const out = { businesses }
  process.stdout.write(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  process.stderr.write(`${err}\n`)
  process.exit(1)
})
