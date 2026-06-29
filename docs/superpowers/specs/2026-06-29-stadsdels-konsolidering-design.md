# Stadsdels-konsolidering för city hubs — design

**Date:** 2026-06-29
**Status:** Proposed (awaiting review)
**Branch:** `seo/stadsdels-konsolidering`

## Problem

City hub pages live at `/loppisar/[city]` and key entirely off the raw
`flea_markets.city` text field. Auto-imported geocoding stored Stockholm
*districts* as distinct `city` values (`Södermalm`, `Vasastaden`,
`Ladugårdsgärdet`, `Kungsholmen`, …). Each becomes its own thin hub.

Consequence (GSC, 30 maj–27 jun 2026):

- `/loppisar/stockholm` shows only ~37 of the ~65 markets that are
  semantically "loppis i Stockholm". It ranks **position ~30.9**, page 3–4,
  **0 clicks** despite being the highest-demand city in the niche.
- District queries (`loppis södermalm` pos 43, `loppis vasastan` pos 26)
  match thin district hubs that also rank poorly. Demand is scattered across
  many weak pages instead of concentrated on one strong page.
- URL Inspection: the Stockholm hub has **one** referring internal URL
  (`/map`) and was last crawled 1 June — low crawl priority.

The page itself is technically healthy (indexed PASS, breadcrumbs, structured
data, ISR, keyword-rich metadata). This is a **content-architecture /
authority-concentration** problem, not a crawlability one.

`municipality` cannot drive a fix — the geocoder set
`municipality = "Vasastaden"` (the district), not "Stockholm". `region` is
inconsistent (`Stockholms län` / `null` / `Sverige` for the same `city`).

## Decisions (settled during brainstorming)

1. **Consolidation model: fold in + 301 redirect.** Districts disappear as
   separate hubs; their markets render on the parent hub. Old district URLs
   `301` to the parent. Concentrates all authority + internal links into one
   strong page.
2. **Mapping source: curated alias map in code.** An explicit
   `CITY_ALIASES` map in `@fyndstigen/shared`. Deterministic, reviewable,
   keeps raw DB data intact. Crucially, a curated map encodes the
   **district-vs-separate-town judgment** that an automated region/geo rule
   would get wrong (it would wrongly fold Södertälje, Solna, Nacka, Mölndal
   into the metros).

## Architecture

One new module owns the map and a single `canonicalCity()` function. Every
call site that currently keys off raw `city` routes through it, so the
canonicalization is consistent across hub resolution, listing, nearby-cities,
redirects, and the sitemap.

```
                       ┌─────────────────────────────┐
 raw city string  ───▶ │ canonicalCity(raw)          │ ───▶ canonical city
 ("Södermalm")         │   CITY_ALIASES[raw] ?? raw  │      ("Stockholm")
                       └─────────────────────────────┘
                                   ▲
   listCitiesWithMarkets ─────────┤  (aggregate into canonical buckets)
   nearbyCitiesWithMarkets ───────┤  (canonicalize + dedupe RPC output)
   [city]/page.tsx resolveCity ───┤  (match canonical slug, gather rawLabels)
   [city]/page.tsx redirect ──────┤  (district slug → parent slug, 301)
   sitemap ───────────────────────┘  (emit canonical slugs only, deduped)
```

### Unit boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `city-aliases.ts` (new) | Owns the map; `canonicalCity`, `rawLabelsFor`, district-slug→parent-slug index | `slugifyCity` |
| `listCitiesWithMarkets` | Aggregate visible markets into canonical buckets | `canonicalCity` |
| `listMarketsInCity` | Fetch markets for a set of raw labels (**unchanged**) | — |
| `nearbyCitiesWithMarkets` | RPC + canonicalize/dedupe results | `canonicalCity` |
| `[city]/page.tsx` | Resolve canonical slug, 301 district slugs, render grouped | shared module |
| `sitemap` | Emit canonical city slugs only | `canonicalCity` |

## Components

### 1. New module — `packages/shared/src/city-aliases.ts`

```ts
import { slugifyCity } from './format'

/**
 * District → parent-city map. ONLY true districts of a metro municipality.
 * Separate municipalities (Solna, Nacka, Södertälje, Mölndal, Partille,
 * Lund, …) are deliberately NOT here — they keep their own hubs.
 */
export const CITY_ALIASES: Record<string, string> = { /* seed list — see below */ }

/** Canonical city name for a raw label. Identity when not a known district. */
export function canonicalCity(raw: string): string {
  return CITY_ALIASES[raw] ?? raw
}

/** Raw labels (from the live city list) that fold into a canonical city. */
export function rawLabelsFor(canonical: string, allLabels: string[]): string[] {
  return allLabels.filter((l) => canonicalCity(l) === canonical)
}

/** district-slug → parent-slug, for 301 logic. Built once from the map. */
export const DISTRICT_SLUG_TO_PARENT_SLUG: Record<string, string> =
  Object.fromEntries(
    Object.entries(CITY_ALIASES).map(([district, parent]) => [
      slugifyCity(district),
      slugifyCity(parent),
    ]),
  )
```

### 2. `adapters/supabase/server.ts`

- **`listCitiesWithMarkets`** — aggregate into canonical buckets instead of raw
  `city`. Return shape gains `rawLabels`:
  `{ city: canonicalName, marketCount, latestUpdate, rawLabels: string[] }`.
  Stockholm now reports ~65, not 37. (Counting/pagination logic unchanged;
  only the bucket key becomes `canonicalCity(row.city)` and the bucket records
  the set of raw labels seen.)
- **`listMarketsInCity(cityNames)`** — **unchanged**. Already accepts a list and
  does `.in('city', cityNames)`. The page passes the bucket's `rawLabels`.
- **`nearbyCitiesWithMarkets`** — post-process the RPC rows through
  `canonicalCity()`, merge counts for collapsed entries, drop the target's own
  canonical, dedupe. Prevents "Loppisar i närheten av Stockholm" suggesting
  "Södermalm".

### 3. Hub page — `web/src/app/loppisar/[city]/page.tsx`

- `resolveCity(slug)` matches on **canonical** slug
  (`slugifyCity(canonicalCity(c.city)) === slug`), and returns
  `{ canonicalName, rawLabels, marketCount }`.
- **301 redirect**: if the incoming slug is a district alias
  (`DISTRICT_SLUG_TO_PARENT_SLUG[slug]` exists and differs from `slug`), call
  `permanentRedirect('/loppisar/' + parentSlug)` (App Router → HTTP 308,
  treated as permanent by Google). Do this before data fetching.
- **Render grouping**: group the fetched markets by their raw `m.city` under
  district sub-headings (`<h2>Södermalm (7)</h2>`, parent's own markets first).
  Keeps the keyword-rich district terms on the page so we retain
  `loppis södermalm` relevance after folding the dedicated page.
- `generateStaticParams` continues to enumerate canonical slugs (district slugs
  are no longer generated; they 301 via the runtime check).

### 4. Sitemap

Emit **canonical** city slugs only, deduped. District URLs are dropped (they
now 301), so Google stops indexing soon-to-redirect URLs. (Locate the sitemap
generator under `web/src/app/sitemap.*` during implementation and route its
city-slug source through `canonicalCity` + dedupe.)

### 5. Type + parity updates

`packages/shared/src/ports/server.ts` (return type of
`listCitiesWithMarkets`) and the in-memory adapter
(`adapters/in-memory/flea-markets.ts`) must change in lockstep with the
Supabase adapter, or the build/tests break.

## Data flow (Stockholm example)

1. Request `/loppisar/sodermalm` → `DISTRICT_SLUG_TO_PARENT_SLUG['sodermalm']
   = 'stockholm'` → `permanentRedirect('/loppisar/stockholm')`.
2. Request `/loppisar/stockholm` → `resolveCity` finds the canonical bucket,
   `rawLabels = ['Stockholm','Södermalm','Vasastaden','Ladugårdsgärdet',…]`.
3. `listMarketsInCity(rawLabels)` → ~65 markets.
4. Page renders them grouped by district; nearby-cities excludes folded labels.

## Error handling / edge cases

- **Unknown city** (not in map): `canonicalCity` returns identity → behaves
  exactly as today. No regression for non-metro cities.
- **District with markets but parent has none of its own**: still works; bucket
  is keyed by canonical, parent section simply empty.
- **slugifyCity collision** across two canonical cities: not expected for the
  seed set; covered by a test asserting distinct slugs.
- **Self-redirect guard**: only redirect when `parentSlug !== slug`.

## Testing (vitest, co-located)

- `city-aliases.test.ts`:
  - district folds (`canonicalCity('Södermalm') === 'Stockholm'`)
  - separate town does NOT fold (`canonicalCity('Nacka') === 'Nacka'`,
    `canonicalCity('Mölndal') === 'Mölndal'`)
  - unknown city = identity
  - `DISTRICT_SLUG_TO_PARENT_SLUG['sodermalm'] === 'stockholm'`
- Supabase adapter test: Stockholm bucket rolls up `rawLabels` + count;
  `nearbyCitiesWithMarkets` dedupes/canonicalizes and drops self.
- Page test: `/loppisar/sodermalm` → 308 → `/loppisar/stockholm`; Stockholm
  hub renders grouped district sub-headings with rolled-up count.

## Proposed seed alias map — REVIEW REQUIRED

Derived from the live `city`/`region` data and hand-filtered for municipality
membership. **This is the one judgment call that must be right** — folding a
genuine separate town would be an SEO own-goal. Please confirm/correct.

### Stockholm (Stockholms kommun) districts → `Stockholm`
```
Vasastaden, Södermalm, Ladugårdsgärdet, Kungsholmen, Skärholmen, Årsta,
Liljeholmen, Johanneshov, Spånga, Hägerstensåsen, Hässelby strand,
Skarpnäcks gård, Husby, Hjorthagen, Reimersholme, Midsommarkransen,
Stadshagen, Älvsjö, Rågsved, Västberga, Rinkeby, Åkeslund, Gamla Enskede,
Vinsta, Långholmen, Gubbängen, Ulvsunda industriområde, Solhem, Aspudden,
Abrahamsberg, Norra Djurgården, Vällingby, Ålsten, Larsboda, Hökarängen,
Mariehäll, Skarpnäck
```

### Göteborg (Göteborgs kommun) districts → `Göteborg`
```
Masthugget, Eriksberg, Västra Frölunda, Kålltorp, Olskroken, Järnbrott,
Rosenlund, Annedal, Backa, Gamlestaden, Flatås, Kviberg, Angered,
Torslanda, Hisings Kärra
```

### Malmö (Malmö kommun) districts → `Malmö`
```
Limhamn
```

### Explicitly EXCLUDED — separate municipalities, keep their own hubs
```
Stockholm area: Södertälje, Sollentuna, Solna, Sundbyberg, Nacka, Huddinge,
  Täby, Danderyd, Lidingö, Tyresö, Vaxholm, Norrtälje, Ekerö, Gustavsberg,
  Märsta, Upplands Väsby, Nynäshamn, Tumba, Handen, Råsunda (Solna),
  Bergshamra (Solna), Vårby (Huddinge), Sickla (Nacka), Saltsjö-Boo (Nacka),
  Segeltorp (Huddinge), Norsborg (Botkyrka), Hallunda (Botkyrka),
  Bollmora (Tyresö), Djursholm (Danderyd), Näsbypark (Täby), Järna (Södertälje)
Göteborg area: Mölndal, Partille, Kungälv, Lerum, Öckerö, Mölnlycke (Härryda),
  Stenungsund, Hönö
Malmö area: Lund, Helsingborg, Lomma, Staffanstorp, Svedala, Trelleborg,
  Kävlinge
```

### Uncertain — flag for review (left OUT of seed until confirmed)
```
Järva, Sundby, Södra, Storskogen, Björnhuvud, Lättinge, Tullen, Trulsegården
```

## Out of scope (YAGNI)

- No DB migration (raw data stays intact).
- No geospatial / automatic district detection.
- New districts are added as one line in `CITY_ALIASES`.
- No change to the `nearby_cities_with_markets` SQL RPC itself (handled in the
  adapter post-processing layer).
