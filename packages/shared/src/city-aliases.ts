import { slugifyCity } from './format'

/**
 * District → parent-city map. ONLY true districts of a metro municipality.
 * Separate municipalities (Solna, Nacka, Södertälje, Mölndal, Partille, Lund,
 * Helsingborg, …) are deliberately absent — they keep their own hubs.
 * Reviewed 2026-06-29. New districts: add one line here.
 */
export const CITY_ALIASES: Record<string, string> = {
  // --- Stockholm (Stockholms kommun) districts ---
  'Vasastaden': 'Stockholm',
  'Södermalm': 'Stockholm',
  'Ladugårdsgärdet': 'Stockholm',
  'Kungsholmen': 'Stockholm',
  'Skärholmen': 'Stockholm',
  'Årsta': 'Stockholm',
  'Liljeholmen': 'Stockholm',
  'Johanneshov': 'Stockholm',
  'Spånga': 'Stockholm',
  'Hägerstensåsen': 'Stockholm',
  'Hässelby strand': 'Stockholm',
  'Skarpnäcks gård': 'Stockholm',
  'Husby': 'Stockholm',
  'Hjorthagen': 'Stockholm',
  'Reimersholme': 'Stockholm',
  'Midsommarkransen': 'Stockholm',
  'Stadshagen': 'Stockholm',
  'Älvsjö': 'Stockholm',
  'Rågsved': 'Stockholm',
  'Västberga': 'Stockholm',
  'Rinkeby': 'Stockholm',
  'Åkeslund': 'Stockholm',
  'Gamla Enskede': 'Stockholm',
  'Vinsta': 'Stockholm',
  'Långholmen': 'Stockholm',
  'Gubbängen': 'Stockholm',
  'Ulvsunda industriområde': 'Stockholm',
  'Solhem': 'Stockholm',
  'Aspudden': 'Stockholm',
  'Abrahamsberg': 'Stockholm',
  'Norra Djurgården': 'Stockholm',
  'Vällingby': 'Stockholm',
  'Ålsten': 'Stockholm',
  'Larsboda': 'Stockholm',
  'Hökarängen': 'Stockholm',
  'Mariehäll': 'Stockholm',
  'Skarpnäck': 'Stockholm',
  // --- Göteborg (Göteborgs kommun) districts ---
  'Masthugget': 'Göteborg',
  'Eriksberg': 'Göteborg',
  'Västra Frölunda': 'Göteborg',
  'Kålltorp': 'Göteborg',
  'Olskroken': 'Göteborg',
  'Järnbrott': 'Göteborg',
  'Rosenlund': 'Göteborg',
  'Annedal': 'Göteborg',
  'Backa': 'Göteborg',
  'Gamlestaden': 'Göteborg',
  'Flatås': 'Göteborg',
  'Kviberg': 'Göteborg',
  'Angered': 'Göteborg',
  'Torslanda': 'Göteborg',
  'Hisings Kärra': 'Göteborg',
  // --- Malmö (Malmö kommun) districts ---
  'Limhamn': 'Malmö',
}

/** Lowercased alias index — built once, so canonicalCity is case-insensitive. */
const ALIAS_INDEX_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_ALIASES).map(([district, parent]) => [district.toLowerCase(), parent]),
)

/** Canonical city name for a raw label. Identity when not a known district. */
export function canonicalCity(raw: string): string {
  return ALIAS_INDEX_LOWER[raw.toLowerCase()] ?? raw
}

/** Raw labels (from the live city list) that fold into a canonical city. */
export function rawLabelsFor(canonical: string, allLabels: string[]): string[] {
  const target = canonicalCity(canonical).toLowerCase()
  return allLabels.filter((l) => canonicalCity(l).toLowerCase() === target)
}

/**
 * Group raw market rows into canonical-city buckets. District rows fold into
 * their parent; counts sum; latestUpdate is the newest in the group; rawLabels
 * collects every raw `city` string that fell into the bucket (for `.in()`).
 */
export function aggregateCitiesByCanonical(
  rows: Array<{ city: string | null; updatedAt: string }>,
): Array<{ city: string; marketCount: number; latestUpdate: string; rawLabels: string[] }> {
  const byKey = new Map<
    string,
    { marketCount: number; latestUpdate: string; rawLabels: Set<string>; labelCounts: Map<string, number> }
  >()
  for (const row of rows) {
    if (!row.city) continue
    const canonical = canonicalCity(row.city)
    const key = canonical.toLowerCase()
    const cur = byKey.get(key)
    if (cur) {
      cur.marketCount += 1
      if (row.updatedAt > cur.latestUpdate) cur.latestUpdate = row.updatedAt
      cur.rawLabels.add(row.city)
      cur.labelCounts.set(canonical, (cur.labelCounts.get(canonical) ?? 0) + 1)
    } else {
      byKey.set(key, {
        marketCount: 1,
        latestUpdate: row.updatedAt,
        rawLabels: new Set([row.city]),
        labelCounts: new Map([[canonical, 1]]),
      })
    }
  }
  return Array.from(byKey.values()).map((v) => ({
    city: pickDisplayLabel(v.labelCounts),
    marketCount: v.marketCount,
    latestUpdate: v.latestUpdate,
    rawLabels: Array.from(v.rawLabels),
  }))
}

/**
 * Pick one display label among casing variants: most frequent, then most
 * uppercase characters (proper-noun casing), then lexicographically first.
 */
function pickDisplayLabel(counts: Map<string, number>): string {
  const upperCount = (s: string) => s.split('').filter((c) => c !== c.toLowerCase()).length
  return Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    const u = upperCount(b[0]) - upperCount(a[0])
    if (u !== 0) return u
    return a[0].localeCompare(b[0], 'sv')
  })[0][0]
}

/**
 * Canonicalize the nearby-cities RPC output: fold districts into parents,
 * merge counts, keep the nearest distance per canonical city, and drop the
 * target city's own canonical (so a hub never lists its own districts as
 * "nearby"). Order preserved by nearest distance ascending.
 */
export function canonicalizeNearbyCities(
  rows: Array<{ city: string; marketCount: number; distanceKm: number }>,
  targetCity: string,
): Array<{ city: string; marketCount: number; distanceKm: number }> {
  const targetCanonical = canonicalCity(targetCity).toLowerCase()
  const byCanonical = new Map<string, { marketCount: number; distanceKm: number }>()
  for (const row of rows) {
    const canonical = canonicalCity(row.city)
    if (canonical.toLowerCase() === targetCanonical) continue
    const cur = byCanonical.get(canonical)
    if (cur) {
      cur.marketCount += row.marketCount
      if (row.distanceKm < cur.distanceKm) cur.distanceKm = row.distanceKm
    } else {
      byCanonical.set(canonical, { marketCount: row.marketCount, distanceKm: row.distanceKm })
    }
  }
  return Array.from(byCanonical.entries())
    .map(([city, v]) => ({ city, marketCount: v.marketCount, distanceKm: v.distanceKm }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

/** district-slug → parent-slug, for 301 redirect logic. Built from the map. */
export const DISTRICT_SLUG_TO_PARENT_SLUG: Record<string, string> =
  Object.fromEntries(
    Object.entries(CITY_ALIASES).map(([district, parent]) => [
      slugifyCity(district),
      slugifyCity(parent),
    ]),
  )
