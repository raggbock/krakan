# Stadsdels-konsolidering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold Stockholm/Göteborg/Malmö districts into their parent city hub so `/loppisar/stockholm` shows all ~65 Stockholm markets on one page, and district URLs 301 to the parent.

**Architecture:** A new `@fyndstigen/shared` module owns a curated district→parent `CITY_ALIASES` map plus pure helpers (`canonicalCity`, `aggregateCitiesByCanonical`, `canonicalizeNearbyCities`, `DISTRICT_SLUG_TO_PARENT_SLUG`). Both data adapters and the hub page route city strings through these helpers, so canonicalization is consistent across listing, nearby-cities, redirects, and the sitemap. Pure helpers carry the logic so they are unit-testable without a live DB.

**Tech Stack:** TypeScript, Next.js (App Router, custom build — see `web/AGENTS.md`), vitest, Supabase JS.

## Global Constraints

- UI text is in **Swedish**.
- Tests are **co-located** with source (`foo.ts` → `foo.test.ts`); no `__tests__/` dirs.
- Commands use explicit `node` paths — `npx` is broken in this monorepo.
- Shared tests: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
- Web tests: `cd web && node ../node_modules/vitest/vitest.mjs run`
- Web typecheck: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
- `@fyndstigen/shared` is the canonical source for domain logic; export new public symbols via `packages/shared/src/index.ts`.
- Only TRUE municipality districts go in `CITY_ALIASES`. Separate towns (Solna, Nacka, Södertälje, Mölndal, Lund…) must NOT be folded.

---

### Task 1: Curated alias map + canonicalization helpers

**Files:**
- Create: `packages/shared/src/city-aliases.ts`
- Create: `packages/shared/src/city-aliases.test.ts`
- Modify: `packages/shared/src/index.ts` (add export)

**Interfaces:**
- Consumes: `slugifyCity` from `./format`
- Produces:
  - `CITY_ALIASES: Record<string, string>`
  - `canonicalCity(raw: string): string`
  - `rawLabelsFor(canonical: string, allLabels: string[]): string[]`
  - `DISTRICT_SLUG_TO_PARENT_SLUG: Record<string, string>`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/city-aliases.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  canonicalCity,
  rawLabelsFor,
  DISTRICT_SLUG_TO_PARENT_SLUG,
  CITY_ALIASES,
} from './city-aliases'

describe('canonicalCity', () => {
  it('folds a Stockholm district into Stockholm', () => {
    expect(canonicalCity('Södermalm')).toBe('Stockholm')
    expect(canonicalCity('Vasastaden')).toBe('Stockholm')
  })
  it('folds Göteborg and Malmö districts', () => {
    expect(canonicalCity('Masthugget')).toBe('Göteborg')
    expect(canonicalCity('Limhamn')).toBe('Malmö')
  })
  it('does NOT fold separate municipalities', () => {
    expect(canonicalCity('Nacka')).toBe('Nacka')
    expect(canonicalCity('Solna')).toBe('Solna')
    expect(canonicalCity('Råsunda')).toBe('Råsunda')
    expect(canonicalCity('Mölndal')).toBe('Mölndal')
    expect(canonicalCity('Lund')).toBe('Lund')
  })
  it('is identity for an unknown city', () => {
    expect(canonicalCity('Vimmerby')).toBe('Vimmerby')
  })
})

describe('rawLabelsFor', () => {
  it('returns every raw label that folds into the canonical city', () => {
    const all = ['Stockholm', 'Södermalm', 'Nacka', 'Vasastaden', 'Göteborg']
    expect(rawLabelsFor('Stockholm', all).sort()).toEqual(
      ['Stockholm', 'Södermalm', 'Vasastaden'].sort(),
    )
  })
})

describe('DISTRICT_SLUG_TO_PARENT_SLUG', () => {
  it('maps a district slug to its parent slug', () => {
    expect(DISTRICT_SLUG_TO_PARENT_SLUG['sodermalm']).toBe('stockholm')
    expect(DISTRICT_SLUG_TO_PARENT_SLUG['masthugget']).toBe('goteborg')
  })
  it('has no separate town as a key', () => {
    expect(DISTRICT_SLUG_TO_PARENT_SLUG['nacka']).toBeUndefined()
  })
  it('every alias value is a real parent city used as a value', () => {
    const parents = new Set(Object.values(CITY_ALIASES))
    expect(parents).toEqual(new Set(['Stockholm', 'Göteborg', 'Malmö']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/city-aliases.test.ts`
Expected: FAIL — cannot resolve `./city-aliases`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/city-aliases.ts`:

```ts
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
```

- [ ] **Step 4: Add the export**

In `packages/shared/src/index.ts`, add alongside the other exports:

```ts
export * from './city-aliases'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/city-aliases.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/city-aliases.ts packages/shared/src/city-aliases.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): curated city-alias map + canonicalization helpers"
```

---

### Task 2: Canonical aggregation helper + wire into both `listCitiesWithMarkets`

**Files:**
- Modify: `packages/shared/src/city-aliases.ts` (add `aggregateCitiesByCanonical`)
- Modify: `packages/shared/src/city-aliases.test.ts` (add tests)
- Modify: `packages/shared/src/ports/server.ts:98` (add `rawLabels` to return type)
- Modify: `packages/shared/src/adapters/supabase/server.ts:195-225`
- Modify: `packages/shared/src/adapters/in-memory.ts:87-103`

**Interfaces:**
- Consumes: `canonicalCity` (Task 1)
- Produces:
  - `aggregateCitiesByCanonical(rows: Array<{ city: string | null; updatedAt: string }>): Array<{ city: string; marketCount: number; latestUpdate: string; rawLabels: string[] }>`
  - `listCitiesWithMarkets()` now returns entries with an added `rawLabels: string[]` (canonical `city`).

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/city-aliases.test.ts`:

```ts
import { aggregateCitiesByCanonical } from './city-aliases'

describe('aggregateCitiesByCanonical', () => {
  it('rolls district rows up under the parent and records raw labels', () => {
    const rows = [
      { city: 'Stockholm', updatedAt: '2026-06-01' },
      { city: 'Södermalm', updatedAt: '2026-06-10' },
      { city: 'Vasastaden', updatedAt: '2026-06-05' },
      { city: 'Nacka', updatedAt: '2026-06-02' },
      { city: null, updatedAt: '2026-06-09' },
    ]
    const out = aggregateCitiesByCanonical(rows)
    const sthlm = out.find((c) => c.city === 'Stockholm')!
    expect(sthlm.marketCount).toBe(3)
    expect(sthlm.latestUpdate).toBe('2026-06-10') // newest across the group
    expect(sthlm.rawLabels.sort()).toEqual(['Stockholm', 'Södermalm', 'Vasastaden'].sort())
    const nacka = out.find((c) => c.city === 'Nacka')!
    expect(nacka.marketCount).toBe(1)
    expect(nacka.rawLabels).toEqual(['Nacka'])
    expect(out.find((c) => c.city === 'Södermalm')).toBeUndefined() // folded away
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/city-aliases.test.ts`
Expected: FAIL — `aggregateCitiesByCanonical` is not exported.

- [ ] **Step 3: Implement the helper**

Append to `packages/shared/src/city-aliases.ts`:

```ts
/**
 * Group raw market rows into canonical-city buckets. District rows fold into
 * their parent; counts sum; latestUpdate is the newest in the group; rawLabels
 * collects every raw `city` string that fell into the bucket (for `.in()`).
 */
export function aggregateCitiesByCanonical(
  rows: Array<{ city: string | null; updatedAt: string }>,
): Array<{ city: string; marketCount: number; latestUpdate: string; rawLabels: string[] }> {
  const byCanonical = new Map<
    string,
    { marketCount: number; latestUpdate: string; rawLabels: Set<string> }
  >()
  for (const row of rows) {
    if (!row.city) continue
    const canonical = canonicalCity(row.city)
    const cur = byCanonical.get(canonical)
    if (cur) {
      cur.marketCount += 1
      if (row.updatedAt > cur.latestUpdate) cur.latestUpdate = row.updatedAt
      cur.rawLabels.add(row.city)
    } else {
      byCanonical.set(canonical, {
        marketCount: 1,
        latestUpdate: row.updatedAt,
        rawLabels: new Set([row.city]),
      })
    }
  }
  return Array.from(byCanonical.entries()).map(([city, v]) => ({
    city,
    marketCount: v.marketCount,
    latestUpdate: v.latestUpdate,
    rawLabels: Array.from(v.rawLabels),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/city-aliases.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the port return type**

In `packages/shared/src/ports/server.ts`, change line 98 from:

```ts
  listCitiesWithMarkets(): Promise<Array<{ city: string; marketCount: number; latestUpdate: string }>>
```

to:

```ts
  listCitiesWithMarkets(): Promise<Array<{ city: string; marketCount: number; latestUpdate: string; rawLabels: string[] }>>
```

- [ ] **Step 6: Wire the Supabase adapter**

In `packages/shared/src/adapters/supabase/server.ts`, replace the body of `listCitiesWithMarkets` (lines ~200-224) so it collects raw rows then delegates to the helper. Keep the pagination loop; only change the accumulation:

```ts
    async listCitiesWithMarkets() {
      // PostgREST caps a single response at 1000 rows — page through.
      const PAGE_SIZE = 1000
      const rows: Array<{ city: string | null; updatedAt: string }> = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('visible_flea_markets')
          .select('city, updated_at')
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) break
        for (const row of data ?? []) {
          rows.push({ city: row.city as string | null, updatedAt: row.updated_at as string })
        }
        if (!data || data.length < PAGE_SIZE) break
      }
      return aggregateCitiesByCanonical(rows)
    },
```

Add the import at the top of the file (alongside other `@fyndstigen/shared`/local imports — match the existing import style in this file):

```ts
import { aggregateCitiesByCanonical } from '../../city-aliases'
```

- [ ] **Step 7: Wire the in-memory adapter**

In `packages/shared/src/adapters/in-memory.ts`, replace `listCitiesWithMarkets` (lines 87-103) with:

```ts
    async listCitiesWithMarkets() {
      const rows = markets.map((m) => ({
        city: (m as unknown as { city?: string }).city ?? null,
        updatedAt: m.updatedAt,
      }))
      return aggregateCitiesByCanonical(rows)
    },
```

Add the import at the top of `in-memory.ts` (match existing import grouping; note the path — `in-memory.ts` is in `src/adapters/`, the module is in `src/`):

```ts
import { aggregateCitiesByCanonical } from '../city-aliases'
```

- [ ] **Step 8: Typecheck + full shared tests**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
Expected: PASS.
Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: no errors (confirms the `rawLabels` type flows through consumers).

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/city-aliases.ts packages/shared/src/city-aliases.test.ts packages/shared/src/ports/server.ts packages/shared/src/adapters/supabase/server.ts packages/shared/src/adapters/in-memory.ts
git commit -m "feat(shared): aggregate city listing into canonical buckets with rawLabels"
```

---

### Task 3: Canonicalize nearby-cities output

**Files:**
- Modify: `packages/shared/src/city-aliases.ts` (add `canonicalizeNearbyCities`)
- Modify: `packages/shared/src/city-aliases.test.ts` (add tests)
- Modify: `packages/shared/src/adapters/supabase/server.ts:338-355`

**Interfaces:**
- Consumes: `canonicalCity` (Task 1)
- Produces: `canonicalizeNearbyCities(rows: Array<{ city: string; marketCount: number; distanceKm: number }>, targetCity: string): Array<{ city: string; marketCount: number; distanceKm: number }>`

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/city-aliases.test.ts`:

```ts
import { canonicalizeNearbyCities } from './city-aliases'

describe('canonicalizeNearbyCities', () => {
  it('folds districts, merges counts, keeps nearest distance, drops the target', () => {
    const rows = [
      { city: 'Södermalm', marketCount: 7, distanceKm: 2 },
      { city: 'Vasastaden', marketCount: 9, distanceKm: 4 },
      { city: 'Nacka', marketCount: 3, distanceKm: 8 },
      { city: 'Stockholm', marketCount: 37, distanceKm: 1 },
    ]
    // target is Stockholm — its own canonical (incl. districts) must be removed
    const out = canonicalizeNearbyCities(rows, 'Stockholm')
    expect(out.find((c) => c.city === 'Stockholm')).toBeUndefined()
    expect(out.find((c) => c.city === 'Södermalm')).toBeUndefined()
    const nacka = out.find((c) => c.city === 'Nacka')!
    expect(nacka.marketCount).toBe(3)
  })
  it('merges two districts of the same nearby parent into one entry', () => {
    const rows = [
      { city: 'Masthugget', marketCount: 5, distanceKm: 3 },
      { city: 'Eriksberg', marketCount: 2, distanceKm: 6 },
    ]
    const out = canonicalizeNearbyCities(rows, 'Kungälv')
    const gbg = out.find((c) => c.city === 'Göteborg')!
    expect(gbg.marketCount).toBe(7)
    expect(gbg.distanceKm).toBe(3) // nearest of the merged group
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/city-aliases.test.ts`
Expected: FAIL — `canonicalizeNearbyCities` is not exported.

- [ ] **Step 3: Implement the helper**

Append to `packages/shared/src/city-aliases.ts`:

```ts
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
  const targetCanonical = canonicalCity(targetCity)
  const byCanonical = new Map<string, { marketCount: number; distanceKm: number }>()
  for (const row of rows) {
    const canonical = canonicalCity(row.city)
    if (canonical === targetCanonical) continue
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run src/city-aliases.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the Supabase adapter**

In `packages/shared/src/adapters/supabase/server.ts`, in `nearbyCitiesWithMarkets`, change the success-path mapping (lines ~350-354) to route through the helper. Replace:

```ts
      return (data ?? []).map((r: { city: string; market_count: number; distance_km: number }) => ({
        city: r.city,
        marketCount: r.market_count,
        distanceKm: r.distance_km,
      }))
```

with:

```ts
      const mapped = (data ?? []).map((r: { city: string; market_count: number; distance_km: number }) => ({
        city: r.city,
        marketCount: r.market_count,
        distanceKm: r.distance_km,
      }))
      return canonicalizeNearbyCities(mapped, cityName)
```

Extend the existing `city-aliases` import (from Task 2) to include the new helper:

```ts
import { aggregateCitiesByCanonical, canonicalizeNearbyCities } from '../../city-aliases'
```

- [ ] **Step 6: Typecheck + shared tests**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
Expected: PASS.
Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/city-aliases.ts packages/shared/src/city-aliases.test.ts packages/shared/src/adapters/supabase/server.ts
git commit -m "feat(shared): canonicalize nearby-cities so hubs don't list own districts"
```

---

### Task 4: Hub page — canonical resolve, 301 district redirects, grouped render

**Files:**
- Modify: `web/src/app/loppisar/[city]/page.tsx`
- Reference (read first): `web/AGENTS.md`, then the redirect docs under `node_modules/next/dist/docs/` for the App Router redirect API.

**Interfaces:**
- Consumes: `canonicalCity`, `DISTRICT_SLUG_TO_PARENT_SLUG`, `slugifyCity`, `listCitiesWithMarkets` (now returns `rawLabels`).
- Produces: hub page behavior — district slugs 301 to parent; parent hub shows rolled-up markets grouped by district.

- [ ] **Step 1: Verify the redirect API in the local Next docs**

This is NOT the Next.js you know (`web/AGENTS.md`). Confirm the permanent-redirect helper name/signature:

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit` is not the check here — instead grep the bundled docs:
Run: `grep -rl "permanentRedirect" node_modules/next/dist/docs/ | head`
Expected: at least one doc file. Read it; confirm `permanentRedirect(path)` is exported from `next/navigation` and issues HTTP 308. If the API differs in this Next build, use the documented permanent-redirect equivalent and adjust Step 4 accordingly.

- [ ] **Step 2: Add imports and the 301 guard**

In `web/src/app/loppisar/[city]/page.tsx`, update the import from `@fyndstigen/shared` (line 6) to add the new symbols, and import `permanentRedirect`:

```ts
import { notFound, permanentRedirect } from 'next/navigation'
import { createSupabaseServerData, slugifyCity, canonicalCity, DISTRICT_SLUG_TO_PARENT_SLUG } from '@fyndstigen/shared'
```

(Keep the other existing imports.)

- [ ] **Step 3: Simplify `resolveCity` to canonical matching**

Replace the `resolveCity` function (lines 35-45) with:

```ts
async function resolveCity(slug: string) {
  if (isPlaceholderEnv()) return null
  const cities = await getServerData().listCitiesWithMarkets()
  // city values are already canonical (districts folded in by the adapter).
  const match = cities.find((c) => slugifyCity(c.city) === slug)
  if (!match) return null
  return {
    canonicalName: match.city,
    cityNames: match.rawLabels, // raw labels for listMarketsInCity(.in('city', …))
    marketCount: match.marketCount,
  }
}
```

(`cityNames` keeps the same name the rest of the file already uses, so downstream calls are unchanged.)

- [ ] **Step 4: Add the redirect at the top of `CityPage`**

In `CityPage` (after `const { city: slug } = await params`, before `resolveCity`), insert:

```ts
  const parentSlug = DISTRICT_SLUG_TO_PARENT_SLUG[slug]
  if (parentSlug && parentSlug !== slug) {
    permanentRedirect(`/loppisar/${parentSlug}`)
  }
```

- [ ] **Step 5: Group the market list by district**

Replace the flat market list container (lines 181-237, the `<div className="mt-8 space-y-4">…</div>` that maps `markets`) with a district-grouped render. Group by raw `m.city`, parent's own label first, then districts alphabetically; only show a sub-heading when more than one group exists:

```tsx
      {(() => {
        const groups = new Map<string, typeof markets>()
        for (const m of markets) {
          const arr = groups.get(m.city) ?? []
          arr.push(m)
          groups.set(m.city, arr)
        }
        const orderedLabels = Array.from(groups.keys()).sort((a, b) => {
          if (a === resolved.canonicalName) return -1
          if (b === resolved.canonicalName) return 1
          return a.localeCompare(b, 'sv')
        })
        const showHeadings = groups.size > 1
        return orderedLabels.map((label) => (
          <section key={label} className="mt-8">
            {showHeadings && (
              <h2 className="font-display text-xl font-bold mb-3">
                {label} ({groups.get(label)!.length})
              </h2>
            )}
            <div className="space-y-4">
              {groups.get(label)!.map((m, i) => (
                <CityMarketLink
                  key={m.id}
                  href={marketUrl(m)}
                  marketId={m.id}
                  marketSlug={m.slug}
                  citySlug={slug}
                  position={i}
                >
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-cream-warm shrink-0">
                    {m.image_url ? (
                      <Image src={m.image_url} alt={m.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FyndstigenLogo size={28} className="text-espresso/15" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <h3 className="font-display font-bold truncate min-w-0">{m.name}</h3>
                      <span className={`stamp text-xs self-start sm:self-auto shrink-0 ${m.is_permanent ? 'text-forest' : 'text-mustard'}`}>
                        {m.is_permanent ? 'Permanent' : 'Tillfällig'}
                      </span>
                    </div>
                    <p className="text-sm text-espresso/75 mt-0.5 truncate">{m.street}, {m.city}</p>
                    {m.description && (
                      <p className="text-sm text-espresso/55 mt-1 line-clamp-2">{m.description}</p>
                    )}
                    {(() => {
                      const hours = formatWeeklyHoursSummary(m.openingHourRules)
                      if (!hours) return null
                      return (
                        <p className="text-sm text-espresso/65 mt-1">
                          <span aria-hidden="true">🕐</span>
                          <span className="sr-only">Öppettider:</span>
                          {' '}{hours}
                          {m.isSystemOwned && (
                            <span className="text-espresso/40 text-xs ml-2">· auto-importerat</span>
                          )}
                        </p>
                      )
                    })()}
                  </div>
                  <span className="text-espresso/20 shrink-0">→</span>
                </CityMarketLink>
              ))}
            </div>
          </section>
        ))
      })()}
```

Note: the per-market heading changed from `<h2>` to `<h3>` because the district name is now the `<h2>`. This keeps a single heading hierarchy (h1 city → h2 district → h3 market).

- [ ] **Step 6: Typecheck**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run existing web tests**

Run: `cd web && node ../node_modules/vitest/vitest.mjs run`
Expected: PASS (no regressions; this page has no co-located test today).

- [ ] **Step 8: Commit**

```bash
git add web/src/app/loppisar/[city]/page.tsx
git commit -m "feat(seo): fold districts into parent city hub with 301s and grouped render"
```

---

### Task 5: Verify the sitemap emits canonical slugs only

**Files:**
- Modify (only if verification fails): `web/src/app/sitemap.ts:53-62`

**Interfaces:**
- Consumes: `listCitiesWithMarkets` (now canonical), `slugifyCity`.

- [ ] **Step 1: Reason about current behavior**

`sitemap.ts` builds city entries from `listCitiesWithMarkets()` and dedupes by `slugifyCity(c.city)` (lines 54-57). Since the adapter now returns canonical `city` values, district slugs can no longer appear. No code change should be required — this task confirms that.

- [ ] **Step 2: Add a guard test for canonical-only city slugs**

Create `web/src/app/sitemap.test.ts` (mock the shared data layer so the test is hermetic):

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@fyndstigen/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fyndstigen/shared')>()
  return {
    ...actual,
    createSupabaseServerData: () => ({
      listPublishedMarketIds: async () => [],
      listCitiesWithMarkets: async () => [
        { city: 'Stockholm', marketCount: 65, latestUpdate: '2026-06-20', rawLabels: ['Stockholm', 'Södermalm'] },
        { city: 'Nacka', marketCount: 3, latestUpdate: '2026-06-20', rawLabels: ['Nacka'] },
      ],
      listPublishedRouteIds: async () => [],
      listPublishedBlockSaleIds: async () => [],
    }),
    createSupabaseImages: () => ({}),
  }
})

import sitemap from './sitemap'

describe('sitemap city pages', () => {
  it('emits canonical city slugs and no district slug', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://fyndstigen.se/loppisar/stockholm')
    expect(urls).not.toContain('https://fyndstigen.se/loppisar/sodermalm')
  })
})
```

- [ ] **Step 3: Run the test**

Run: `cd web && node ../node_modules/vitest/vitest.mjs run src/app/sitemap.test.ts`
Expected: PASS. If it FAILS because the mock shape doesn't match the real `createSupabaseServerData` usage in `sitemap.ts`, adjust the mocked methods to match exactly the methods `sitemap.ts` calls (see lines 29-34), then re-run. Do NOT change production code unless a real district slug leaks through.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/sitemap.test.ts
git commit -m "test(seo): assert sitemap emits canonical city slugs only"
```

---

### Task 6: Full verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Shared tests**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
Expected: PASS.

- [ ] **Step 2: Web tests**

Run: `cd web && node ../node_modules/vitest/vitest.mjs run`
Expected: PASS.

- [ ] **Step 3: Web typecheck**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional, staging)**

After deploy to staging, confirm:
- `GET /loppisar/sodermalm` → 308 → `/loppisar/stockholm`
- `/loppisar/stockholm` shows ~65 markets grouped by district
- `/loppisar/nacka` still resolves to its own hub (NOT redirected)
- Stockholm sitemap entry present; `sodermalm` absent

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore(seo): verification fixups for stadsdels-konsolidering"
```

## Notes for the implementer

- The `rawLabels` on `listCitiesWithMarkets` is the load-bearing addition: it lets the hub fetch markets for all folded districts via the existing `listMarketsInCity(cityNames)` (`.in('city', cityNames)`) without changing that method.
- Do not add separate municipalities to `CITY_ALIASES`. The test in Task 1 (`canonicalCity('Nacka') === 'Nacka'`) is the guardrail.
- The `nearby_cities_with_markets` SQL RPC is untouched; all folding happens in the adapter layer.
