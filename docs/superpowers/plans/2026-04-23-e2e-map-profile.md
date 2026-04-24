# E2E Map Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 4 map/route E2E tests (list markers, build route, reorder, empty bbox) running against an in-memory adapter swap — no Supabase, no real OSRM.

**Architecture:** `@fyndstigen/shared` already exports `makeInMemoryDeps()`. When `NEXT_PUBLIC_E2E_FAKE=1`, `web/src/providers/query-provider.tsx` picks the in-memory deps instead of the Supabase deps. Tests seed data by calling a small `window.__E2E__` bridge. OSRM fetches are intercepted by Playwright `page.route()` against JSON fixtures in `web/e2e/fixtures/osrm/`.

**Tech Stack:** Playwright, `@fyndstigen/shared` in-memory adapters (already mature — see `packages/shared/src/adapters/in-memory/`), Next.js `NEXT_PUBLIC_*` env.

**Spec:** `docs/superpowers/specs/2026-04-23-e2e-testing-design.md` section 4.

**Depends on:** `2026-04-23-e2e-foundation.md` completed.

---

### Task 1: Add E2E-bridge module

**Files:**
- Create: `web/src/lib/e2e/bridge.ts`
- Create: `web/src/lib/e2e/bridge.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// web/src/lib/e2e/bridge.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createE2EBridge } from './bridge'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'

describe('createE2EBridge', () => {
  it('exposes seed/reset/setNow on a target object', () => {
    const target: Record<string, unknown> = {}
    const deps = makeInMemoryDeps({})
    createE2EBridge(deps, target)
    expect(typeof (target.__E2E__ as { seed: unknown }).seed).toBe('function')
    expect(typeof (target.__E2E__ as { reset: unknown }).reset).toBe('function')
    expect(typeof (target.__E2E__ as { setNow: unknown }).setNow).toBe('function')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd web && node ../node_modules/vitest/vitest.mjs run src/lib/e2e/bridge.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// web/src/lib/e2e/bridge.ts
import type { Deps } from '@fyndstigen/shared'
import type { FleaMarket } from '@fyndstigen/shared'

export type E2EBridge = {
  seed: (markets: FleaMarket[]) => void
  reset: () => void
  setNow: (iso: string) => void
}

/**
 * Attaches a seed/reset/setNow API to `target` (typically `window`) so
 * Playwright tests can preload the in-memory deps before navigation.
 *
 * The in-memory adapters expose raw mutation helpers on the port itself;
 * here we just forward them through a stable surface.
 */
export function createE2EBridge(deps: Deps, target: Record<string, unknown>): E2EBridge {
  const bridge: E2EBridge = {
    seed(markets) {
      const mut = deps.markets as unknown as { seed?: (m: FleaMarket[]) => void }
      if (typeof mut.seed !== 'function') {
        throw new Error('E2E bridge: deps.markets.seed missing — not running in-memory?')
      }
      mut.seed(markets)
    },
    reset() {
      const mut = deps.markets as unknown as { reset?: () => void }
      mut.reset?.()
    },
    setNow(iso) {
      ;(target as { __E2E_NOW__?: string }).__E2E_NOW__ = iso
    },
  }
  target.__E2E__ = bridge
  return bridge
}
```

- [ ] **Step 4: Run — expect pass**

```bash
node ../node_modules/vitest/vitest.mjs run src/lib/e2e/bridge.test.ts
```

- [ ] **Step 5: Check that in-memory adapters already expose seed/reset**

```bash
grep -n "seed\|reset" ../packages/shared/src/adapters/in-memory/flea-markets.ts | head -10
```

If missing, STOP and add sub-task: extend `createInMemoryFleaMarkets` with `seed(markets)` and `reset()` methods, commit in `packages/shared`, update consumers of the type. (The in-memory adapter tests in `packages/shared/src/adapters/in-memory/flea-markets.test.ts` are the pattern.)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/e2e/
git commit -m "feat(e2e): window.__E2E__ bridge for seeding in-memory deps"
```

---

### Task 2: Conditional deps swap in the provider

**Files:**
- Modify: `web/src/providers/query-provider.tsx`

- [ ] **Step 1: Rewrite to branch on `NEXT_PUBLIC_E2E_FAKE`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { makeSupabaseDeps, makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { supabase } from '@/lib/supabase'
import { DepsProvider } from './deps-provider'
import { createE2EBridge } from '@/lib/e2e/bridge'

const isE2EFake = process.env.NEXT_PUBLIC_E2E_FAKE === '1'

function buildAppDeps() {
  if (isE2EFake) {
    const deps = makeInMemoryDeps({})
    if (typeof window !== 'undefined') {
      createE2EBridge(deps, window as unknown as Record<string, unknown>)
    }
    return deps
  }
  return makeSupabaseDeps(supabase)
}

const appDeps = buildAppDeps()

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: isE2EFake ? 0 : 60 * 1000,
            retry: isE2EFake ? 0 : 1,
          },
        },
      }),
  )

  return (
    <DepsProvider deps={appDeps}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </DepsProvider>
  )
}
```

- [ ] **Step 2: Verify existing unit tests pass**

```bash
cd web && node ../node_modules/vitest/vitest.mjs run
```

Expected: PASS (unchanged behavior when `NEXT_PUBLIC_E2E_FAKE` is unset).

- [ ] **Step 3: Type-check**

```bash
node ../node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/providers/query-provider.tsx
git commit -m "feat(e2e): swap to in-memory deps when NEXT_PUBLIC_E2E_FAKE=1"
```

---

### Task 3: OSRM fixture helpers

**Files:**
- Create: `web/e2e/helpers/osrm.ts`
- Create: `web/e2e/helpers/record-osrm-fixtures.mjs`

- [ ] **Step 1: Write fixture loader**

```ts
// web/e2e/helpers/osrm.ts
import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'osrm')

function hashCoords(url: string): string {
  // OSRM URL format: .../route/v1/driving/lon,lat;lon,lat;...
  const coordSegment = url.split('/driving/')[1]?.split('?')[0] ?? ''
  return createHash('sha1').update(coordSegment).digest('hex').slice(0, 16)
}

export async function installOsrmFixtures(page: Page): Promise<void> {
  await page.route('**/router.project-osrm.org/**', async (route) => {
    const url = route.request().url()
    const key = hashCoords(url)
    const fixturePath = join(FIXTURE_DIR, `${key}.json`)
    if (!existsSync(fixturePath)) {
      throw new Error(
        `OSRM fixture missing for ${key} (url=${url}). Run \`npm run e2e:fixtures\` to record.`,
      )
    }
    const body = readFileSync(fixturePath, 'utf-8')
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}
```

- [ ] **Step 2: Write recorder script**

```js
// web/e2e/helpers/record-osrm-fixtures.mjs
// Usage: node e2e/helpers/record-osrm-fixtures.mjs "lon1,lat1;lon2,lat2"
import { createHash } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'osrm')

const coords = process.argv[2]
if (!coords) {
  console.error('Usage: record-osrm-fixtures.mjs "lon1,lat1;lon2,lat2"')
  process.exit(1)
}

const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
const res = await fetch(url)
if (!res.ok) {
  console.error(`OSRM returned ${res.status}`)
  process.exit(1)
}
const body = await res.text()
const key = createHash('sha1').update(coords).digest('hex').slice(0, 16)
mkdirSync(FIXTURE_DIR, { recursive: true })
writeFileSync(join(FIXTURE_DIR, `${key}.json`), body)
console.log(`Wrote fixture ${key}.json`)
```

- [ ] **Step 3: Add npm script**

Modify `web/package.json` scripts:

```json
"e2e:fixtures": "node e2e/helpers/record-osrm-fixtures.mjs"
```

- [ ] **Step 4: Commit**

```bash
git add web/e2e/helpers/osrm.ts web/e2e/helpers/record-osrm-fixtures.mjs web/package.json
git commit -m "feat(e2e): OSRM fixture interceptor + recorder script"
```

---

### Task 4: Seed fixtures for the test scenarios

**Files:**
- Create: `web/e2e/fixtures/markets.ts`

- [ ] **Step 1: Define test markets**

```ts
// web/e2e/fixtures/markets.ts
import type { FleaMarket } from '@fyndstigen/shared'

export const gothenburgMarkets: FleaMarket[] = [
  {
    id: 'm1',
    name: 'Kungsportsavenyn Loppis',
    slug: 'kungsportsavenyn',
    lat: 57.7015,
    lng: 11.9719,
    // fill in the other required FleaMarket fields — the engineer should
    // open `packages/shared/src/types.ts` for the canonical shape and match it.
    // Keep openings broad enough that `setNow('2026-04-23T12:00:00Z')` marks all open.
  } as FleaMarket,
  // ...4 more; exact coords listed in docs/superpowers/specs/2026-04-23-e2e-testing-design.md §5
]
```

The engineer must read `packages/shared/src/types.ts` for the `FleaMarket` shape — do not guess fields. All 5 markets live in Gothenburg (coords in Task 5).

- [ ] **Step 2: Type-check**

```bash
cd web && node ../node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/e2e/fixtures/markets.ts
git commit -m "test(e2e): seed data — 5 gothenburg markets for map tests"
```

---

### Task 5: Record OSRM fixtures for the scenarios

Coordinates (lon,lat) used by the tests:

- `m1`: 11.9719,57.7015 (Kungsportsavenyn)
- `m2`: 11.9665,57.7072 (Haga)
- `m3`: 11.9520,57.6969 (Linnéstaden)
- `m4`: 11.9850,57.7100 (Gamlestaden)
- `m5`: 12.0100,57.7200 (Partille)

Required fixtures: any ordered triple the tests visit. We record all permutations `m1→m2→m3` and `m1→m3→m2` (for reorder test).

- [ ] **Step 1: Record the three-stop routes**

```bash
cd web
npm run e2e:fixtures -- "11.9719,57.7015;11.9665,57.7072;11.9520,57.6969"
npm run e2e:fixtures -- "11.9719,57.7015;11.9520,57.6969;11.9665,57.7072"
```

Expected: two files written in `web/e2e/fixtures/osrm/`.

- [ ] **Step 2: Commit**

```bash
git add web/e2e/fixtures/osrm/
git commit -m "test(e2e): record OSRM fixtures for map test scenarios"
```

---

### Task 6: Shared map-profile fixture — autoload seed + OSRM

**Files:**
- Modify: `web/e2e/helpers/test.ts`

- [ ] **Step 1: Extend the base test with map fixtures**

```ts
// web/e2e/helpers/test.ts
import { test as base, expect } from '@playwright/test'
import { installOsrmFixtures } from './osrm'
import type { FleaMarket } from '@fyndstigen/shared'

type MapFixtures = {
  seedMarkets: (markets: FleaMarket[]) => Promise<void>
  setNow: (iso: string) => Promise<void>
}

export const test = base.extend<MapFixtures>({
  page: async ({ page }, use) => {
    await installOsrmFixtures(page)
    await use(page)
  },
  seedMarkets: async ({ page }, use) => {
    await use(async (markets) => {
      await page.waitForFunction(() => !!(window as unknown as { __E2E__?: unknown }).__E2E__)
      await page.evaluate((m) => {
        const bridge = (window as unknown as { __E2E__: { seed: (x: unknown) => void } }).__E2E__
        bridge.seed(m)
      }, markets)
    })
  },
  setNow: async ({ page }, use) => {
    await use(async (iso) => {
      await page.evaluate((i) => {
        const bridge = (window as unknown as { __E2E__: { setNow: (x: string) => void } }).__E2E__
        bridge.setNow(i)
      }, iso)
    })
  },
})

export { expect }
```

- [ ] **Step 2: Commit**

```bash
git add web/e2e/helpers/test.ts
git commit -m "test(e2e): map-profile fixtures (seedMarkets, setNow, OSRM autoload)"
```

---

### Task 7: Test 1 — `list-markets-on-map.spec.ts`

**Files:**
- Create: `web/e2e/map/list-markets-on-map.spec.ts`
- Delete: `web/e2e/map/placeholder.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test('map renders one marker per seeded market', async ({ page, seedMarkets, setNow }) => {
  await page.goto('/utforska')
  await setNow('2026-04-23T12:00:00Z')
  await seedMarkets(gothenburgMarkets)
  await page.reload()

  // Leaflet renders markers with the .leaflet-marker-icon class.
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(gothenburgMarkets.length)
})

test('"öppet nu" filter hides markets closed at the current time', async ({
  page,
  seedMarkets,
  setNow,
}) => {
  await page.goto('/utforska')
  // Move clock to a Monday 3am when all seeded markets are closed.
  await setNow('2026-04-20T03:00:00Z')
  await seedMarkets(gothenburgMarkets)
  await page.reload()

  await page.getByRole('checkbox', { name: /öppet nu/i }).check()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0)
})
```

- [ ] **Step 2: Remove placeholder and run**

```bash
cd web
rm e2e/map/placeholder.spec.ts
npm run e2e:map
```

Expected: both scenarios pass.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/map/
git commit -m "test(e2e): map renders seeded markers + respects öppet-nu filter"
```

---

### Task 8: Test 2 — `build-loppisrunda.spec.ts`

**Files:**
- Create: `web/e2e/map/build-loppisrunda.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test('user adds three markets to a loppisrunda and sees total distance', async ({
  page,
  seedMarkets,
  setNow,
}) => {
  await page.goto('/utforska')
  await setNow('2026-04-23T12:00:00Z')
  await seedMarkets(gothenburgMarkets)
  await page.reload()

  // Click the first three markers and "Lägg till i rundan".
  // Exact selectors depend on bookable-tables-card / marker popup — engineer
  // should run `npm run e2e:map -- --debug` once to record the right locators.
  for (const slug of ['kungsportsavenyn', 'haga', 'linnestaden']) {
    await page.getByRole('link', { name: new RegExp(slug, 'i') }).click()
    await page.getByRole('button', { name: /lägg till i rundan/i }).click()
    await page.goBack()
  }

  await page.getByRole('link', { name: /min runda/i }).click()
  await expect(page.getByText(/total sträcka/i)).toBeVisible()
  await expect(page.getByText(/\d+[,.]\d+ km/)).toBeVisible()
})
```

- [ ] **Step 2: Run**

```bash
npm run e2e:map -- build-loppisrunda.spec.ts
```

Expected: PASS. If selectors don't match production markup, use `--debug` to fix them — do NOT change the markup to fit the test.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/map/build-loppisrunda.spec.ts
git commit -m "test(e2e): build a 3-stop loppisrunda and verify total distance"
```

---

### Task 9: Test 3 — `reorder-loppisrunda.spec.ts`

**Files:**
- Create: `web/e2e/map/reorder-loppisrunda.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '../helpers/test'
import { gothenburgMarkets } from '../fixtures/markets'

test('reordering a loppisrunda triggers a new distance calculation', async ({
  page,
  seedMarkets,
  setNow,
}) => {
  await page.goto('/utforska')
  await setNow('2026-04-23T12:00:00Z')
  await seedMarkets(gothenburgMarkets)
  await page.reload()

  // Build m1 → m2 → m3 (reuse helper once extracted; inline for now)
  for (const slug of ['kungsportsavenyn', 'haga', 'linnestaden']) {
    await page.getByRole('link', { name: new RegExp(slug, 'i') }).click()
    await page.getByRole('button', { name: /lägg till i rundan/i }).click()
    await page.goBack()
  }
  await page.getByRole('link', { name: /min runda/i }).click()

  const before = await page.getByTestId('total-distance').innerText()

  // Swap stops 2 and 3 (m2 ↔ m3). Use the reorder buttons; exact role TBD by
  // engineer from the route UI — add data-testid="route-stop-move-up" etc. if
  // needed (minimal change, not a feature addition).
  await page.getByTestId('route-stop-linnestaden-move-up').click()

  await expect(page.getByTestId('total-distance')).not.toHaveText(before)
})
```

Note: if `data-testid` hooks are missing on route-stop rows, add them in the same commit as this test — treat it as instrumentation, not a feature change.

- [ ] **Step 2: Run**

```bash
npm run e2e:map -- reorder-loppisrunda.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add web/e2e/map/reorder-loppisrunda.spec.ts web/src/components/
git commit -m "test(e2e): reorder loppisrunda recalculates total distance"
```

---

### Task 10: Test 4 — `empty-bbox.spec.ts`

**Files:**
- Create: `web/e2e/map/empty-bbox.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '../helpers/test'

test('empty search area shows the empty state', async ({ page, seedMarkets }) => {
  await page.goto('/utforska')
  await seedMarkets([]) // no markets
  await page.reload()

  await expect(page.getByText(/inga loppisar/i)).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0)
})
```

Exact Swedish empty-state string — check `web/src/lib/messages.sv.ts`. Update regex if phrasing differs.

- [ ] **Step 2: Run**

```bash
npm run e2e:map -- empty-bbox.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add web/e2e/map/empty-bbox.spec.ts
git commit -m "test(e2e): empty bbox shows empty state"
```

---

### Task 11: Full suite + CI green

- [ ] **Step 1: Run full map profile**

```bash
cd web && npm run e2e:map
```

Expected: 5 tests green (2 from Task 7, then 8/9/10).

- [ ] **Step 2: Push and verify CI**

```bash
git push
```

The `e2e-map` job from plan 1 already runs this suite — confirm green.

---

## Acceptance

- `npm run e2e:map` runs 5 tests, all green locally and in CI.
- No Supabase, no real OSRM contacted during the run.
- OSRM fixtures committed and regeneratable via `npm run e2e:fixtures`.
- `NEXT_PUBLIC_E2E_FAKE=1` path verified not to affect production code paths (unit tests still green in Task 2 Step 2).
