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

/** Canonical city name for a raw label. Identity when not a known district. */
export function canonicalCity(raw: string): string {
  return CITY_ALIASES[raw] ?? raw
}

/** Raw labels (from the live city list) that fold into a canonical city. */
export function rawLabelsFor(canonical: string, allLabels: string[]): string[] {
  return allLabels.filter((l) => canonicalCity(l) === canonical)
}

/** district-slug → parent-slug, for 301 redirect logic. Built from the map. */
export const DISTRICT_SLUG_TO_PARENT_SLUG: Record<string, string> =
  Object.fromEntries(
    Object.entries(CITY_ALIASES).map(([district, parent]) => [
      slugifyCity(district),
      slugifyCity(parent),
    ]),
  )
