#!/usr/bin/env node
/**
 * Hand-curated seed for chains too small to justify their own scrapers:
 *   - Göteborgs Stadsmission second-hand (~9 butiker)
 *   - Skåne Stadsmission second-hand (~4 butiker)
 *   - Björkåfrihet second-hand (3 butiker)
 *
 * Source data was lifted from each chain's public store page on
 * 2026-04-26 — re-run if their stores change. Each row gets geocoded
 * via Nominatim (1 req/s) for lat/lng + region/municipality, then the
 * output JSON matches the admin-business-import contract.
 *
 *   node scripts/fetch-small-chains.mjs supabase/seed/small-chains.json
 *   node scripts/bulk-import-markets.mjs supabase/seed/small-chains.json
 *
 * Idempotent: bulk-import-markets.mjs skips slugs that already exist.
 */

import { writeFileSync } from 'node:fs'

const OUTPUT_PATH = process.argv[2] ?? null
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Fyndstigen/1.0 (sebastian.myrdahl@gmail.com)'
const ÖREBRO = { lat: 59.2741, lng: 15.2066 }

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

// --- Seed data ----------------------------------------------------------
//
// Each entry has the bare minimum we need: street + city + postal code,
// the chain's display name, source URL, opening hours, and contact info
// when known. Geocoder fills lat/lng + municipality/region.

const RAW = [
  // ─── Göteborgs Stadsmission ───────────────────────────────────────────
  {
    chain: 'gbgsm', label: 'Alelyckan',
    street: 'Lärjeågatan 12', postalCode: '415 02', locality: 'Göteborg',
    hours: [['tuesday','10:00','18:00'],['wednesday','10:00','18:00'],['thursday','10:00','18:00'],['friday','10:00','18:00'],['saturday','10:00','16:00'],['sunday','10:00','16:00']],
  },
  {
    chain: 'gbgsm', label: 'Alingsås',
    street: 'Göteborgsvägen 16', postalCode: '441 32', locality: 'Alingsås',
    hours: [['monday','10:00','18:00'],['tuesday','10:00','18:00'],['wednesday','10:00','18:00'],['thursday','10:00','18:00'],['friday','10:00','18:00'],['saturday','10:00','16:00']],
  },
  {
    chain: 'gbgsm', label: 'Angered',
    street: 'Angereds Torg 9', postalCode: '424 65', locality: 'Angered',
    hours: [['monday','10:00','19:00'],['tuesday','10:00','19:00'],['wednesday','10:00','19:00'],['thursday','10:00','19:00'],['friday','10:00','19:00'],['saturday','10:00','17:00'],['sunday','11:00','16:00']],
  },
  {
    chain: 'gbgsm', label: 'Arkaden',
    street: 'Fredsgatan 1', postalCode: '411 07', locality: 'Göteborg',
    hours: [['monday','10:00','19:00'],['tuesday','10:00','19:00'],['wednesday','10:00','19:00'],['thursday','10:00','19:00'],['friday','10:00','19:00'],['saturday','10:00','18:00'],['sunday','11:00','17:00']],
  },
  {
    chain: 'gbgsm', label: 'Bellevue',
    street: 'Korpralsgatan 1', postalCode: '415 05', locality: 'Göteborg',
    hours: [['monday','10:00','18:00'],['tuesday','10:00','18:00'],['wednesday','10:00','18:00'],['thursday','10:00','18:00'],['friday','10:00','18:00'],['saturday','10:00','16:00'],['sunday','10:00','16:00']],
  },
  {
    chain: 'gbgsm', label: 'Borås',
    street: 'Österlånggatan 31', postalCode: '503 31', locality: 'Borås',
    hours: [['wednesday','10:00','18:00'],['thursday','10:00','18:00'],['friday','10:00','18:00'],['saturday','10:00','16:00']],
  },
  {
    chain: 'gbgsm', label: 'Frölunda',
    street: 'Lergöksgatan 4', postalCode: '421 50', locality: 'Västra Frölunda',
    hours: [['tuesday','10:00','18:00'],['wednesday','10:00','18:00'],['thursday','10:00','18:00'],['friday','10:00','18:00'],['saturday','10:00','16:00'],['sunday','10:00','16:00']],
  },
  {
    chain: 'gbgsm', label: 'Stigbergstorget',
    street: 'Amerikagatan 4', postalCode: '414 63', locality: 'Göteborg',
    hours: [['monday','10:00','19:00'],['tuesday','10:00','19:00'],['wednesday','10:00','19:00'],['thursday','10:00','19:00'],['friday','10:00','19:00'],['saturday','10:00','17:00'],['sunday','10:00','17:00']],
  },

  // ─── Skåne Stadsmission ───────────────────────────────────────────────
  {
    chain: 'skanesm', label: 'Triangeln',
    street: 'Södra Tullgatan 3', postalCode: '211 40', locality: 'Malmö',
    notes: 'Triangelns köpcentrum, plan 2',
  },
  {
    chain: 'skanesm', label: 'Mobilia',
    street: 'Per Albin Hanssons väg 40', postalCode: '214 32', locality: 'Malmö',
  },
  {
    chain: 'skanesm', label: 'Outlet',
    street: 'Botildenborgsvägen 75', postalCode: '214 51', locality: 'Malmö',
  },

  // ─── Björkåfrihet ─────────────────────────────────────────────────────
  {
    chain: 'bjorka', label: 'Backaplan',
    street: 'Ångpannegatan 5', postalCode: '417 05', locality: 'Göteborg',
    phoneRaw: '031-51 81 16',
    hours: [['monday','10:00','19:00'],['tuesday','10:00','19:00'],['wednesday','10:00','19:00'],['thursday','10:00','19:00'],['friday','10:00','19:00'],['saturday','11:00','17:00'],['sunday','11:00','16:00']],
  },
  {
    chain: 'bjorka', label: 'Linné',
    street: 'Linnégatan 9', postalCode: '413 04', locality: 'Göteborg',
    phoneRaw: '031-775 35 40',
    hours: [['monday','11:00','19:00'],['tuesday','11:00','19:00'],['wednesday','11:00','19:00'],['thursday','11:00','19:00'],['friday','11:00','19:00'],['saturday','11:00','17:00'],['sunday','11:00','16:00']],
  },
  {
    chain: 'bjorka', label: 'City',
    street: 'Södra Förstadsgatan 14', postalCode: '211 43', locality: 'Malmö',
    phoneRaw: '040-97 10 15',
    hours: [['monday','11:00','19:00'],['tuesday','11:00','19:00'],['wednesday','11:00','19:00'],['thursday','11:00','19:00'],['friday','11:00','19:00'],['saturday','10:00','17:00'],['sunday','12:00','16:00']],
  },
]

const CHAIN_META = {
  gbgsm:   { prefix: 'gbgsm-stadsmission',   name: 'Göteborgs Stadsmission Second Hand', website: 'https://www.stadsmissionen.org/second-hand/butiker/', source: 'stadsmissionen.org' },
  skanesm: { prefix: 'skanesm-stadsmission', name: 'Skåne Stadsmission Second Hand',     website: 'https://www.skanestadsmission.se/second-hand/',          source: 'skanestadsmission.se' },
  bjorka:  { prefix: 'bjorka-frihet',        name: 'Björkåfrihet Second Hand',           website: 'https://bjorkafrihet.se/oppettider-bjorkafrihet-second-hand-butiker/', source: 'bjorkafrihet.se' },
}

function normalizePhone(raw) {
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = '+' + digits.slice(2)
  if (digits.startsWith('0')) digits = '+46' + digits.slice(1)
  if (!digits.startsWith('+')) digits = '+46' + digits
  return digits
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

async function main() {
  const businesses = []
  console.error(`Building ${RAW.length} businesses…`)

  for (let i = 0; i < RAW.length; i++) {
    const r = RAW[i]
    const meta = CHAIN_META[r.chain]
    if (!meta) { console.error(`Unknown chain: ${r.chain}`); continue }
    const slug = `${meta.prefix}-${slugify(`${r.locality}-${r.label}`)}`

    const q = `${r.street}, ${r.postalCode} ${r.locality}, Sverige`
    process.stderr.write(`  [${i + 1}/${RAW.length}] ${meta.name} ${r.label}…`)
    const g = await geocode(q)
    if (g) process.stderr.write(` ${g.lat},${g.lng}\n`)
    else   process.stderr.write(` NO GEOCODE\n`)

    businesses.push({
      slug,
      name: `${meta.name} ${r.label}`,
      category: 'Kyrklig-bistånd',
      description: r.notes ?? null,
      address: {
        street: r.street,
        postalCode: r.postalCode,
        locality: r.locality,
        municipality: g?.municipality ?? r.locality,
        region: g?.region ?? 'Sverige',
        country: 'Sverige',
      },
      geo: g ? { lat: g.lat, lng: g.lng, precision: 'address', source: 'nominatim' } : null,
      contact: {
        phone: normalizePhone(r.phoneRaw),
        phoneRaw: r.phoneRaw ?? null,
        email: null,
        website: meta.website,
        facebook: null,
        instagram: null,
      },
      openingHours: r.hours ? { regular: r.hours.map(([day, opens, closes]) => ({ day, opens, closes })) } : null,
      distanceFromOrebroKm: g ? haversineKm(ÖREBRO, { lat: g.lat, lng: g.lng }) : null,
      status: 'unverified',
      takeover: { shouldSendEmail: false, priority: 2 },
      notes: null,
      source: meta.source,
    })

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
