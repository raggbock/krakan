# E2E Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `web/e2e/` into multi-profile Playwright projects, create the shared helper/fixture scaffold, add `.env.e2e` handling, add CI workflow skeleton, and migrate the existing smoke test — so the map and onboarding plans can plug in without touching infrastructure.

**Architecture:** Keep a single `web/playwright.config.ts`. Split tests into `e2e/smoke/`, `e2e/map/`, `e2e/onboarding/` under Playwright `projects`. Shared helpers in `e2e/helpers/`. CI workflow runs `e2e-map` and `e2e-smoke` on every PR; `e2e-onboarding` is added (non-blocking) in plan 3.

**Tech Stack:** Playwright 1.59, Next.js 16.2 dev server, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-04-23-e2e-testing-design.md` sections 2 and 6.

---

### Task 1: Create new directory layout

**Files:**
- Create: `web/e2e/smoke/` (dir)
- Create: `web/e2e/map/` (dir)
- Create: `web/e2e/onboarding/` (dir)
- Create: `web/e2e/helpers/` (dir)
- Create: `web/e2e/fixtures/` (dir)
- Create: `web/e2e/README.md`

- [ ] **Step 1: Create directories and stub README**

```bash
cd web
mkdir -p e2e/smoke e2e/map e2e/onboarding e2e/helpers e2e/fixtures/osrm e2e/fixtures/images
```

Write `web/e2e/README.md`:

````markdown
# E2E tests

Playwright tests split into three **profiles**:

- `smoke` — public-page smokes. No backend mocking. Runs against local dev.
- `map` — map/route UI tests. In-memory adapter swap via `NEXT_PUBLIC_E2E_FAKE=1`, OSRM fixtures.
- `onboarding` — full onboarding + booking flows. Requires local Supabase + stripe-mock (Docker).

## Commands

```bash
cd web
npm run e2e                  # everything (requires Docker for onboarding)
npm run e2e:smoke            # public-page smokes
npm run e2e:map              # map/route tests (fast, no Docker)
npm run e2e:onboarding       # onboarding + booking (Docker required)
```

## Prerequisites

- **Map + smoke:** nothing beyond the repo.
- **Onboarding:** Docker Desktop running, Supabase CLI (`supabase --version`). See `docs/superpowers/specs/2026-04-23-e2e-testing-design.md`.

## Fixtures

OSRM fixtures live in `e2e/fixtures/osrm/<sha1-of-coords>.json`. Regenerate with `npm run e2e:fixtures` (see plan 2).
````

- [ ] **Step 2: Commit**

```bash
git add web/e2e/
git commit -m "chore(e2e): scaffold smoke/map/onboarding directory layout"
```

---

### Task 2: Restructure `playwright.config.ts` into projects

**Files:**
- Modify: `web/playwright.config.ts`

- [ ] **Step 1: Rewrite config with three projects**

Full file:

```ts
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3000)
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`
const IS_CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: IS_CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'map',
      testDir: './e2e/map',
      use: {
        ...devices['Desktop Chrome'],
        // Dev server is started with NEXT_PUBLIC_E2E_FAKE=1 (see webServer below)
      },
    },
    {
      name: 'onboarding',
      testDir: './e2e/onboarding',
      use: { ...devices['Desktop Chrome'] },
      // globalSetup for this project is wired up in plan 3.
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node ../node_modules/next/dist/bin/next dev -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !IS_CI,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_E2E_FAKE: process.env.E2E_PROFILE === 'map' ? '1' : '',
        },
      },
})
```

Note: `NEXT_PUBLIC_E2E_FAKE` is set only when the engineer explicitly runs with `E2E_PROFILE=map`. The npm scripts in Task 5 wire this up.

- [ ] **Step 2: Move existing smoke test into smoke dir**

```bash
git mv web/e2e/smoke.spec.ts web/e2e/smoke/smoke.spec.ts
```

- [ ] **Step 3: Verify smoke still runs**

```bash
cd web
npm run dev &   # or leave a dev server running
node ../node_modules/@playwright/test/cli.js test --project=smoke
```

Expected: all existing smoke tests pass. Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add web/playwright.config.ts web/e2e/smoke/smoke.spec.ts
git commit -m "chore(e2e): split playwright config into smoke/map/onboarding projects"
```

---

### Task 3: Add base helper — typed Playwright test with project tag

**Files:**
- Create: `web/e2e/helpers/test.ts`

- [ ] **Step 1: Write the helper**

```ts
// web/e2e/helpers/test.ts
import { test as base, expect } from '@playwright/test'

/**
 * Shared base test. Fixtures added per profile in later plans
 * (asOrganizer / asVisitor in plan 3, seed helpers in plan 2).
 */
export const test = base
export { expect }
```

- [ ] **Step 2: Update smoke test to import from helper**

Modify `web/e2e/smoke/smoke.spec.ts` line 1:

```ts
import { expect, test } from '../helpers/test'
```

- [ ] **Step 3: Run smoke again to confirm import works**

```bash
node ../node_modules/@playwright/test/cli.js test --project=smoke
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/helpers/test.ts web/e2e/smoke/smoke.spec.ts
git commit -m "chore(e2e): add shared test helper re-export"
```

---

### Task 4: `.env.e2e` template and gitignore

**Files:**
- Create: `web/.env.e2e.example`
- Modify: `web/.gitignore`

- [ ] **Step 1: Create example env file**

```
# web/.env.e2e.example
# Copied to .env.e2e by `npm run e2e:env:init`; .env.e2e is gitignored.
# Map profile uses only NEXT_PUBLIC_E2E_FAKE; onboarding profile uses the rest.

NEXT_PUBLIC_E2E_FAKE=
# --- Local Supabase (filled by globalSetup in plan 3) ---
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# --- Stripe mock (plan 3) ---
STRIPE_SECRET_KEY=sk_test_123
STRIPE_API_BASE=http://127.0.0.1:12111
E2E_STRIPE_STUB=1
ALLOW_E2E_HOOKS=1
```

- [ ] **Step 2: Gitignore `.env.e2e`**

Append to `web/.gitignore`:

```
# E2E local env (generated by globalSetup)
.env.e2e
```

- [ ] **Step 3: Commit**

```bash
git add web/.env.e2e.example web/.gitignore
git commit -m "chore(e2e): add .env.e2e.example template"
```

---

### Task 5: Add npm scripts

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Update scripts block**

Replace the existing `test:e2e` / `test:e2e:ui` entries. New scripts block (only the relevant keys shown):

```json
"test:e2e": "node ../node_modules/@playwright/test/cli.js test",
"test:e2e:ui": "node ../node_modules/@playwright/test/cli.js test --ui",
"e2e": "node ../node_modules/@playwright/test/cli.js test",
"e2e:smoke": "node ../node_modules/@playwright/test/cli.js test --project=smoke",
"e2e:map": "cross-env E2E_PROFILE=map node ../node_modules/@playwright/test/cli.js test --project=map",
"e2e:onboarding": "cross-env E2E_PROFILE=onboarding node ../node_modules/@playwright/test/cli.js test --project=onboarding"
```

- [ ] **Step 2: Add `cross-env` devDependency**

```bash
cd web
npm install --save-dev cross-env
```

- [ ] **Step 3: Verify `npm run e2e:smoke` works**

```bash
npm run e2e:smoke
```

Expected: PASS (same as Task 2 step 3).

- [ ] **Step 4: Commit**

```bash
git add web/package.json ../package-lock.json
git commit -m "chore(e2e): add per-profile npm scripts"
```

---

### Task 6: CI workflow skeleton

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: E2E

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  e2e-smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd web && npx playwright install --with-deps chromium
      - run: cd web && npm run e2e:smoke
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-smoke-trace
          path: web/test-results/

  e2e-map:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd web && npx playwright install --with-deps chromium
      - run: cd web && npm run e2e:map
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-map-trace
          path: web/test-results/
```

Onboarding job is appended in plan 3.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci(e2e): add smoke + map jobs (onboarding added later)"
```

---

### Task 7: Wire empty stub tests so CI map job passes

The map job has no tests yet (plan 2 adds them). Prevent a "no tests found" CI failure with a single passing placeholder.

**Files:**
- Create: `web/e2e/map/placeholder.spec.ts`

- [ ] **Step 1: Write placeholder**

```ts
// Removed in plan 2, task 7 (first real map test lands there).
import { test, expect } from '../helpers/test'

test('map profile scaffold is wired', async () => {
  expect(process.env.E2E_PROFILE).toBe('map')
})
```

- [ ] **Step 2: Run**

```bash
cd web
npm run e2e:map
```

Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
git add web/e2e/map/placeholder.spec.ts
git commit -m "test(e2e): map profile placeholder so CI job has work"
```

---

### Task 8: Verify end-to-end

- [ ] **Step 1: Run all local profiles**

```bash
cd web
npm run e2e:smoke
npm run e2e:map
```

Expected: both green.

- [ ] **Step 2: Push branch and confirm CI green**

```bash
git push
gh pr create --fill
```

Watch the `E2E / e2e-smoke` and `E2E / e2e-map` checks. Fix any flakes before merging.

---

## Acceptance

- `npm run e2e:smoke` and `npm run e2e:map` pass locally.
- CI workflow runs both jobs on PRs.
- Existing smoke tests unchanged in behavior.
- Directory layout ready for plan 2 (map) and plan 3 (onboarding) to plug in.
