#!/usr/bin/env node
// Records OSRM fixtures for E2E tests.
//
// Usage:
//   node e2e/helpers/record-osrm-fixtures.mjs "lon1,lat1;lon2,lat2[;...]"
//
// The output file is named by sha1(coords) so the Playwright interceptor in
// osrm.ts finds it at test time.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashCoords } from './osrm-hash.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(HERE, '..', 'fixtures', 'osrm')

const coords = process.argv[2]
if (!coords) {
  console.error('Usage: record-osrm-fixtures.mjs "lon1,lat1;lon2,lat2[;...]"')
  process.exit(1)
}

const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

const res = await fetch(url)
if (!res.ok) {
  console.error(`OSRM responded ${res.status} ${res.statusText}`)
  process.exit(1)
}

const body = await res.text()
const key = hashCoords(coords)
mkdirSync(FIXTURE_DIR, { recursive: true })
const outPath = join(FIXTURE_DIR, `${key}.json`)
writeFileSync(outPath, body)
console.log(`Wrote ${outPath} (${body.length} bytes)`)
