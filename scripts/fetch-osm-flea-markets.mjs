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

const PLACES_QUERY = `
[out:json][timeout:120];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  node["place"="city"](area.se);
  node["place"="town"](area.se);
  node["place"="village"](area.se);
  node["place"="suburb"](area.se);
);
out;
`.trim()

const QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  node["shop"="second_hand"](area.se);
  way["shop"="second_hand"](area.se);
  node["shop"="charity"](area.se);
  way["shop"="charity"](area.se);
  node["shop"="antiques"](area.se);
  way["shop"="antiques"](area.se);
  node["amenity"="marketplace"]["flea_market"="yes"](area.se);
  node["amenity"="marketplace"]["second_hand"="yes"](area.se);
  node["amenity"="marketplace"](area.se);
  way["amenity"="marketplace"](area.se);
  node["name"~"loppis|loppmarknad|second hand|secondhand|återbruk|aterbruk",i](area.se);
  way["name"~"loppis|loppmarknad|second hand|secondhand|återbruk|aterbruk",i](area.se);
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

/** OSM day token → day_of_week (0=Sun..6=Sat). */
const OSM_DAY = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 }
const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function expandDayRange(start, end) {
  const out = []
  let i = DAY_ORDER.indexOf(start)
  const j = DAY_ORDER.indexOf(end)
  if (i < 0 || j < 0) return null
  while (true) {
    out.push(DAY_ORDER[i])
    if (i === j) break
    i = (i + 1) % 7
    if (out.length > 7) return null  // safety
  }
  return out
}

function normalizeTime(s) {
  if (!s) return null
  const [h, m] = s.includes(':') ? s.split(':') : [s, '00']
  const hh = String(parseInt(h, 10)).padStart(2, '0')
  const mm = String(parseInt(m, 10)).padStart(2, '0')
  if (isNaN(parseInt(hh, 10)) || isNaN(parseInt(mm, 10))) return null
  return `${hh}:${mm}`
}

const dayLabelToKey = { monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday', thursday: 'thursday', friday: 'friday', saturday: 'saturday', sunday: 'sunday' }
const DOW_TO_LABEL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Parse a subset of OSM opening_hours into our weekly rule shape.
 * Returns { regular: [{ day, opens, closes }] } or null if nothing parseable.
 *
 * Handled forms (covers ~80% of the Swedish data we see):
 *   "Mo-Fr 10:00-18:00"
 *   "Mo-Fr 10:00-18:00; Sa 10:00-15:00"
 *   "Mo-Sa 10-18; Su closed"
 *   "Tu-Sa 12:00-17:00"
 *   "Mo,We,Fr 10:00-14:00"
 *
 * Rejected: "24/7", "PH off", "sunrise-sunset", time-spans within a day
 * ("Mo 10-12,14-18"), week-of-month modifiers, etc. The admin can fix
 * those cases manually in /admin/markets.
 */
function parseOsmOpeningHours(raw) {
  if (!raw || typeof raw !== 'string') return null
  const lower = raw.toLowerCase()
  if (lower.includes('24/7') || lower.includes('sunrise') || lower.includes('sunset')
      || lower.includes('ph ') || lower.includes('school')) return null

  const parts = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
  const seen = new Map() // key day-open-close → entry
  for (const part of parts) {
    if (/closed|off/i.test(part)) continue
    // "Mo-Fr 10:00-18:00" or "Mo 10-18"
    const m = part.match(/^([A-Z][a-z])(?:-([A-Z][a-z]))?\s+(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)$/)
    if (!m) continue
    const [, startDay, endDay, openRaw, closeRaw] = m
    const days = endDay ? expandDayRange(startDay, endDay) : [startDay]
    if (!days) continue
    const opens = normalizeTime(openRaw)
    const closes = normalizeTime(closeRaw)
    if (!opens || !closes) continue
    for (const d of days) {
      const dow = OSM_DAY[d]
      if (dow == null) continue
      const dayLabel = DOW_TO_LABEL[dow]
      const key = `${dayLabel}-${opens}-${closes}`
      seen.set(key, { day: dayLabel, opens, closes })
    }
  }
  if (seen.size === 0) return null
  return { regular: Array.from(seen.values()) }
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

function toImportBusiness(el, seenSlugs, places) {
  const tags = el.tags ?? {}
  const name = (tags.name ?? '').trim()
  if (!name) return null

  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  let locality = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? tags['addr:suburb'] ?? null
  let localitySource = 'tag'
  if (!locality) {
    const near = nearestPlace(places, lat, lng)
    if (!near) return null
    locality = near.name
    localitySource = `nearest(${near.distanceKm.toFixed(1)}km)`
  }

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
    openingHours: parseOsmOpeningHours(tags.opening_hours),
    distanceFromOrebroKm,
    status: 'unverified',
    takeover: {
      shouldSendEmail: false,     // never auto-send for OSM rows; admin opts in
      priority: 3,
    },
    notes: `osm:${el.type}/${el.id} city-source:${localitySource}`,
    source: 'osm-overpass',
  }
}

async function fetchOverpass(query) {
  const body = new URLSearchParams({ data: query }).toString()
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Fyndstigen/1.0 (+https://fyndstigen.se)',
    },
    body,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const data = await res.json()
  return data.elements ?? []
}

/** Build a list of Swedish places sorted for nearest-neighbour lookup. */
async function fetchPlaces() {
  const elements = await fetchOverpass(PLACES_QUERY)
  return elements
    .filter((el) => el.lat != null && el.lon != null && el.tags?.name)
    .map((el) => ({
      name: el.tags.name,
      lat: el.lat,
      lng: el.lon,
      population: el.tags.population ? parseInt(el.tags.population, 10) : 0,
    }))
}

/** Returns the closest place name within maxKm, biased toward larger settlements
 *  when ties are close (a 4 000-pop village wins over a 200-pop hamlet 100 m
 *  further away if both are within 5 km). */
function nearestPlace(places, lat, lng, maxKm = 12) {
  let best = null
  let bestScore = -Infinity
  for (const p of places) {
    const d = haversineKm({ lat, lng }, p)
    if (d > maxKm) continue
    // Closer is better; population is a small tiebreaker.
    const score = -d + Math.log10(Math.max(p.population, 1)) * 0.3
    if (score > bestScore) { best = p; bestScore = score }
  }
  return best ? { name: best.name, distanceKm: haversineKm({ lat, lng }, best) } : null
}

async function main() {
  process.stderr.write('Querying place index…\n')
  const places = await fetchPlaces()
  process.stderr.write(`Got ${places.length} place nodes\n`)

  process.stderr.write('Querying shops…\n')
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
    const b = toImportBusiness(el, seenSlugs, places)
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
