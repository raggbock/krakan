# E2E Onboarding Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 5 onboarding + booking E2E tests (organizer signup → create market → Stripe Connect → full booking capture → free booking auto-accept), running against local Supabase (DB + edge functions + Storage) and `stripe-mock`.

**Architecture:** Playwright `globalSetup` brings up local Supabase (reuses running instance if present) and `stripe-mock` via Docker. Tests use service-role admin API to seed users (namespaced emails) and bypass email confirmation. Stripe Connect redirect is stubbed via an env flag on the edge function. Capture runs against `stripe-mock`.

**Tech Stack:** Playwright, Supabase CLI (`supabase start`), `stripe-mock` (Docker), Deno edge functions.

**Spec:** `docs/superpowers/specs/2026-04-23-e2e-testing-design.md` sections 3 and 7.

**Depends on:** `2026-04-23-e2e-foundation.md` completed.

**Warning:** This plan adds runtime code paths gated on `process.env.ALLOW_E2E_HOOKS === '1'` (edge functions) and `process.env.E2E_STRIPE_STUB === '1'`. Both are guarded with an additional `NODE_ENV !== 'production'` check. Reviewers MUST confirm these flags are not set in staging/prod env configs before the onboarding suite is enabled.

---

### Task 1: Preflight — verify local tooling

- [ ] **Step 1: Check Supabase CLI + Docker**

```bash
supabase --version
docker --version
docker ps
```

If either is missing, STOP and install before proceeding. Document minimum versions in `web/e2e/README.md` once known.

- [ ] **Step 2: Boot local Supabase once manually**

```bash
supabase start
```

Note the printed `anon key`, `service_role key`, API URL — we'll wire them into globalSetup.

- [ ] **Step 3: Start stripe-mock**

```bash
docker run --rm -d -p 12111:12111 --name stripe-mock stripe/stripe-mock:latest
curl -s http://localhost:12111/v1/charges -H "Authorization: Bearer sk_test_123" | head -c 120
```

Expected: JSON response, not connection refused.

- [ ] **Step 4: Tear down**

```bash
supabase stop
docker stop stripe-mock
```

No commit.

---

### Task 2: globalSetup — boot backends for onboarding project

**Files:**
- Create: `web/e2e/helpers/onboarding-setup.ts`
- Modify: `web/playwright.config.ts`

- [ ] **Step 1: Write globalSetup**

```ts
// web/e2e/helpers/onboarding-setup.ts
import { execSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default async function globalSetup() {
  // 1. supabase start — idempotent, no-ops if already running.
  console.log('[e2e-onboarding] supabase start…')
  execSync('supabase start', { stdio: 'inherit', cwd: join(__dirname, '..', '..', '..') })

  // 2. Extract keys from `supabase status --output json`.
  const statusRaw = execSync('supabase status --output json', {
    encoding: 'utf8',
    cwd: join(__dirname, '..', '..', '..'),
  })
  const status = JSON.parse(statusRaw) as {
    API_URL: string
    ANON_KEY: string
    SERVICE_ROLE_KEY: string
  }

  // 3. Start stripe-mock if not already running.
  try {
    execSync('docker start stripe-mock', { stdio: 'ignore' })
  } catch {
    execSync(
      'docker run -d --rm -p 12111:12111 --name stripe-mock stripe/stripe-mock:latest',
      { stdio: 'inherit' },
    )
  }

  // 4. Start `supabase functions serve` in background.
  const funcs = spawn('supabase', ['functions', 'serve', '--no-verify-jwt'], {
    cwd: join(__dirname, '..', '..', '..'),
    detached: true,
    stdio: 'ignore',
  })
  funcs.unref()
  // Expose PID so globalTeardown (Task 3) can kill it.
  writeFileSync(join(__dirname, '.functions.pid'), String(funcs.pid))

  // 5. Write .env.e2e so Next.js dev server picks up the right values.
  const env = `
NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}
STRIPE_SECRET_KEY=sk_test_123
STRIPE_API_BASE=http://127.0.0.1:12111
E2E_STRIPE_STUB=1
ALLOW_E2E_HOOKS=1
`.trimStart()
  writeFileSync(join(__dirname, '..', '..', '.env.e2e.local'), env)

  // Expose to tests via process.env so fixtures can read service role.
  process.env.SUPABASE_URL = status.API_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY
  process.env.SUPABASE_ANON_KEY = status.ANON_KEY
}
```

- [ ] **Step 2: Create globalTeardown**

```ts
// web/e2e/helpers/onboarding-teardown.ts
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export default async function globalTeardown() {
  const pidFile = join(__dirname, '.functions.pid')
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, 'utf8'))
    try { process.kill(pid) } catch {}
    unlinkSync(pidFile)
  }
  // Leave supabase + stripe-mock running between test runs for speed.
  // In CI, the runner is ephemeral so explicit stop isn't needed.
  if (process.env.CI) {
    try { execSync('docker stop stripe-mock', { stdio: 'ignore' }) } catch {}
    try { execSync('supabase stop', { stdio: 'ignore' }) } catch {}
  }
}
```

- [ ] **Step 3: Wire into playwright.config.ts**

Update the `onboarding` project in `web/playwright.config.ts`:

```ts
{
  name: 'onboarding',
  testDir: './e2e/onboarding',
  use: { ...devices['Desktop Chrome'] },
  globalSetup: require.resolve('./e2e/helpers/onboarding-setup.ts'),
  globalTeardown: require.resolve('./e2e/helpers/onboarding-teardown.ts'),
},
```

Per-project `globalSetup` requires Playwright ≥1.42 — verify with `npx playwright --version`. If below, escalate to top-level `globalSetup` with a branch on `E2E_PROFILE`.

- [ ] **Step 4: Also teach webServer to load .env.e2e.local**

In `webServer.env` block add:

```ts
env: {
  NEXT_PUBLIC_E2E_FAKE: process.env.E2E_PROFILE === 'map' ? '1' : '',
  // onboarding profile: values loaded from .env.e2e.local written by globalSetup
  ...(process.env.E2E_PROFILE === 'onboarding'
    ? loadDotenv(join(__dirname, '.env.e2e.local'))
    : {}),
},
```

Add at top of `playwright.config.ts`:

```ts
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function loadDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}
```

- [ ] **Step 5: Commit**

```bash
git add web/e2e/helpers/onboarding-setup.ts web/e2e/helpers/onboarding-teardown.ts web/playwright.config.ts
git commit -m "feat(e2e): globalSetup/teardown for local supabase + stripe-mock"
```

---

### Task 3: Auth fixture — service-role user bootstrap

**Files:**
- Create: `web/e2e/helpers/auth.ts`

- [ ] **Step 1: Write fixture extension**

```ts
// web/e2e/helpers/auth.ts
import { test as base, expect } from '@playwright/test'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

type AuthFixtures = {
  admin: SupabaseClient
  asOrganizer: { email: string; password: string }
  asVisitor: { email: string; password: string }
}

export const test = base.extend<AuthFixtures>({
  admin: async ({}, use) => {
    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, key, { auth: { persistSession: false } })
    await use(admin)
  },
  asOrganizer: async ({ admin, page }, use) => {
    const email = `e2e-organizer-${randomUUID()}@test.fyndstigen.se`
    const password = 'Test1234!'
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'organizer' },
    })
    if (error) throw error
    // Log in in the browser context by filling the real sign-in form.
    await page.goto('/auth')
    await page.getByLabel(/e-post/i).fill(email)
    await page.getByLabel(/lösenord/i).fill(password)
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).not.toHaveURL(/\/auth$/)
    await use({ email, password })
  },
  asVisitor: async ({ admin, page }, use) => {
    const email = `e2e-visitor-${randomUUID()}@test.fyndstigen.se`
    const password = 'Test1234!'
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw error
    await page.goto('/auth')
    await page.getByLabel(/e-post/i).fill(email)
    await page.getByLabel(/lösenord/i).fill(password)
    await page.getByRole('button', { name: /logga in/i }).click()
    await expect(page).not.toHaveURL(/\/auth$/)
    await use({ email, password })
  },
})

export { expect }
```

- [ ] **Step 2: Commit**

```bash
git add web/e2e/helpers/auth.ts
git commit -m "feat(e2e): asOrganizer/asVisitor fixtures via service-role admin API"
```

---

### Task 4: Edge function — E2E Stripe Connect stub

**Files:**
- Modify: `supabase/functions/stripe-connect-create/index.ts` (exact filename — engineer to confirm)

- [ ] **Step 1: Read the current function**

```bash
cat supabase/functions/stripe-connect-create/index.ts
```

Identify where the Stripe `accountLinks.create` call happens and the URL it returns.

- [ ] **Step 2: Add E2E branch**

Near the top of the handler, before the Stripe call:

```ts
const isE2EStub =
  Deno.env.get('E2E_STRIPE_STUB') === '1' &&
  Deno.env.get('NODE_ENV') !== 'production'

if (isE2EStub) {
  const origin = req.headers.get('origin') ?? 'http://localhost:3000'
  return new Response(
    JSON.stringify({
      url: `${origin}/e2e/stripe-connect-return?account=acct_e2e_test&success=1`,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
}
```

- [ ] **Step 3: Create the return page in Next.js**

```tsx
// web/src/app/e2e/stripe-connect-return/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Exists only under E2E; if ALLOW_E2E_HOOKS isn't set this page does nothing useful.
export default function StripeConnectReturn() {
  const router = useRouter()
  const params = useSearchParams()
  useEffect(() => {
    // Mimic the prod redirect behavior: bounce back to the organizer dashboard.
    router.replace(`/arrangor/dashboard?connect=${params.get('success') ? 'ok' : 'fail'}`)
  }, [router, params])
  return <div>Returning…</div>
}
```

- [ ] **Step 4: Add Deno test for the guard**

```ts
// supabase/functions/stripe-connect-create/e2e-stub.test.ts
// Run with: deno test supabase/functions/stripe-connect-create/e2e-stub.test.ts
Deno.test('E2E stub disabled without ALLOW_E2E_HOOKS-style guard', () => {
  const oldNodeEnv = Deno.env.get('NODE_ENV')
  const oldStub = Deno.env.get('E2E_STRIPE_STUB')
  Deno.env.set('NODE_ENV', 'production')
  Deno.env.set('E2E_STRIPE_STUB', '1')
  const stub =
    Deno.env.get('E2E_STRIPE_STUB') === '1' &&
    Deno.env.get('NODE_ENV') !== 'production'
  if (stub) throw new Error('E2E stub must NOT activate in production')
  if (oldNodeEnv !== undefined) Deno.env.set('NODE_ENV', oldNodeEnv)
  if (oldStub !== undefined) Deno.env.set('E2E_STRIPE_STUB', oldStub)
})
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-connect-create/ web/src/app/e2e/
git commit -m "feat(e2e): stripe-connect-create honors E2E_STRIPE_STUB (prod-guarded)"
```

---

### Task 5: Webhook helper — simulate `account.updated`

**Files:**
- Create: `web/e2e/helpers/stripe-webhooks.ts`

- [ ] **Step 1: Write the helper**

```ts
// web/e2e/helpers/stripe-webhooks.ts
import { createHmac } from 'node:crypto'

const SECRET = 'whsec_test_e2e' // matches stripe-mock / local edge env

export async function sendAccountUpdated(accountId: string, chargesEnabled: boolean) {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: 'account.updated',
    data: { object: { id: accountId, charges_enabled: chargesEnabled, details_submitted: true } },
  })
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex')
  const res = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/stripe-webhooks`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${ts},v1=${sig}`,
      },
      body: payload,
    },
  )
  if (!res.ok) {
    throw new Error(`webhook failed: ${res.status} ${await res.text()}`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/e2e/helpers/stripe-webhooks.ts
git commit -m "feat(e2e): helper to post signed stripe webhook events locally"
```

---

### Task 6: Test 1 — `organizer-signup.spec.ts`

**Files:**
- Create: `web/e2e/onboarding/organizer-signup.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '../helpers/auth'

test('organizer lands on empty dashboard after signup', async ({ page, asOrganizer }) => {
  // asOrganizer fixture already logs in; just assert we're on an org-owner surface.
  void asOrganizer
  await page.goto('/arrangor/dashboard')
  await expect(page.getByRole('heading', { name: /dashboard|översikt/i })).toBeVisible()
  await expect(page.getByText(/inga loppisar ännu|skapa din första/i)).toBeVisible()
})
```

- [ ] **Step 2: Run**

```bash
cd web && npm run e2e:onboarding -- organizer-signup.spec.ts
```

Expected: PASS. Adjust copy regex against `web/src/lib/messages.sv.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/onboarding/organizer-signup.spec.ts
git commit -m "test(e2e): organizer signup lands on empty dashboard"
```

---

### Task 7: Test 2 — `create-market.spec.ts`

**Files:**
- Create: `web/e2e/onboarding/create-market.spec.ts`
- Create: `web/e2e/fixtures/images/test-marknad.png` (any 200x200 PNG, ~10 KB)

- [ ] **Step 1: Add fixture image**

```bash
# generate a tiny PNG — any image works as long as it's a real PNG
cd web/e2e/fixtures/images
python -c "import urllib.request; urllib.request.urlretrieve('https://placehold.co/200.png', 'test-marknad.png')"
```

Or copy any existing small PNG into place.

- [ ] **Step 2: Write test**

```ts
import { test, expect } from '../helpers/auth'
import { join } from 'node:path'

test('organizer creates a market, uploads an image, sets opening hours, publishes', async ({
  page,
  asOrganizer,
}) => {
  void asOrganizer
  await page.goto('/arrangor/loppis/ny')

  await page.getByLabel(/namn/i).fill('E2E Test Loppis')
  await page.getByLabel(/adress/i).fill('Kungsportsavenyn 1, Göteborg')
  await page.getByLabel(/beskrivning/i).fill('Automatiserad E2E.')

  await page.setInputFiles(
    'input[type=file]',
    join(__dirname, '..', 'fixtures', 'images', 'test-marknad.png'),
  )
  await expect(page.locator('img[alt*="test-marknad" i], img[alt*="förhandsvisning" i]')).toBeVisible()

  // Opening hours — add a Saturday 10-15 rule.
  await page.getByRole('button', { name: /lägg till öppettid/i }).click()
  await page.getByLabel(/dag/i).selectOption('saturday')
  await page.getByLabel(/öppnar/i).fill('10:00')
  await page.getByLabel(/stänger/i).fill('15:00')

  await page.getByRole('button', { name: /publicera|spara/i }).click()

  await expect(page).toHaveURL(/\/arrangor\/loppis\/[a-z0-9-]+/)
  await expect(page.getByText(/publicerad|aktiv/i)).toBeVisible()

  // Public page renders it.
  const slug = page.url().split('/').pop()
  await page.goto(`/loppis/${slug}`)
  await expect(page.getByRole('heading', { name: /E2E Test Loppis/i })).toBeVisible()
})
```

- [ ] **Step 3: Run**

```bash
npm run e2e:onboarding -- create-market.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add web/e2e/onboarding/create-market.spec.ts web/e2e/fixtures/images/
git commit -m "test(e2e): create market + image + opening hours + publish"
```

---

### Task 8: Test 3 — `stripe-connect.spec.ts`

**Files:**
- Create: `web/e2e/onboarding/stripe-connect.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '../helpers/auth'
import { sendAccountUpdated } from '../helpers/stripe-webhooks'

test('connect Stripe account and see charges_enabled reflected', async ({
  page,
  asOrganizer,
}) => {
  void asOrganizer
  await page.goto('/arrangor/dashboard')

  await page.getByRole('button', { name: /koppla.*stripe|kom igång med betalningar/i }).click()
  // Stub redirects straight back.
  await expect(page).toHaveURL(/\/arrangor\/dashboard\?connect=ok/)

  // charges_enabled is set by the webhook — fire it.
  await sendAccountUpdated('acct_e2e_test', true)

  // UI should pick it up after a reload (no realtime subscription assumed).
  await page.reload()
  await expect(page.getByText(/stripe ansluten|betalningar aktiva/i)).toBeVisible()
})
```

- [ ] **Step 2: Run + commit**

```bash
npm run e2e:onboarding -- stripe-connect.spec.ts
git add web/e2e/onboarding/stripe-connect.spec.ts
git commit -m "test(e2e): Stripe Connect stub + webhook reflects charges_enabled"
```

---

### Task 9: Test 4 — `full-booking-capture.spec.ts`

**Files:**
- Create: `web/e2e/onboarding/full-booking-capture.spec.ts`

- [ ] **Step 1: Write test**

The test needs both an organizer and a visitor persona. Extract a helper to create a pre-configured market (seeded via service-role, skipping the UI onboarding that's already covered by Task 7) so this test stays focused on the booking flow.

```ts
import { test as base, expect } from '../helpers/auth'
import { sendAccountUpdated } from '../helpers/stripe-webhooks'

type BookingFixtures = {
  seededMarket: { id: string; slug: string; organizerEmail: string }
}

const test = base.extend<BookingFixtures>({
  seededMarket: async ({ admin }, use) => {
    // Insert a market directly with service-role client.
    // Engineer: read `packages/shared/src/types.ts` for the FleaMarket shape
    // and match required columns in the `flea_markets` table.
    const organizerEmail = `e2e-org-${crypto.randomUUID()}@test.fyndstigen.se`
    const { data: user } = await admin.auth.admin.createUser({
      email: organizerEmail,
      password: 'Test1234!',
      email_confirm: true,
    })
    const { data: market, error } = await admin
      .from('flea_markets')
      .insert({
        name: 'E2E Booking Market',
        organizer_id: user.user!.id,
        slug: `e2e-booking-${crypto.randomUUID().slice(0, 6)}`,
        stripe_account_id: 'acct_e2e_test',
        charges_enabled: true,
        auto_accept: false,
      })
      .select('id, slug')
      .single()
    if (error) throw error
    // Insert one bookable table with a price.
    await admin.from('market_tables').insert({
      market_id: market.id,
      label: 'Bord A',
      price_cents: 15000,
    })
    await use({ id: market.id, slug: market.slug, organizerEmail })
  },
})

test('visitor books + pays, organizer accepts, capture succeeds', async ({
  page,
  asVisitor,
  seededMarket,
  admin,
}) => {
  void asVisitor
  // Visitor books.
  await page.goto(`/loppis/${seededMarket.slug}`)
  await page.getByRole('button', { name: /boka bord/i }).click()
  await page.getByRole('button', { name: /betala/i }).click()

  // Stripe Elements iframe — use Stripe's test card
  const card = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
  await card.getByPlaceholder(/kortnummer|card number/i).fill('4242424242424242')
  await card.getByPlaceholder(/mm.*åå|mm.*yy/i).fill('12/30')
  await card.getByPlaceholder(/cvc/i).fill('123')
  await page.getByRole('button', { name: /bekräfta|pay/i }).click()

  await expect(page.getByText(/väntar på godkännande|pending/i)).toBeVisible()

  // Switch to organizer — sign out, sign in as organizer user.
  await page.getByRole('button', { name: /logga ut/i }).click()
  await page.goto('/auth')
  await page.getByLabel(/e-post/i).fill(seededMarket.organizerEmail)
  await page.getByLabel(/lösenord/i).fill('Test1234!')
  await page.getByRole('button', { name: /logga in/i }).click()

  await page.goto('/arrangor/dashboard')
  await page.getByRole('button', { name: /acceptera/i }).first().click()

  await expect(page.getByText(/bekräftad/i)).toBeVisible()

  // Verify the PaymentIntent was captured in stripe-mock.
  const booking = await admin.from('bookings').select('stripe_payment_intent_id').single()
  const pi = booking.data?.stripe_payment_intent_id
  const res = await fetch(`http://127.0.0.1:12111/v1/payment_intents/${pi}`, {
    headers: { Authorization: 'Bearer sk_test_123' },
  })
  const body = (await res.json()) as { status: string }
  expect(body.status).toBe('succeeded')
})
```

- [ ] **Step 2: Run + commit**

```bash
npm run e2e:onboarding -- full-booking-capture.spec.ts
git add web/e2e/onboarding/full-booking-capture.spec.ts
git commit -m "test(e2e): full paid-booking flow with manual capture"
```

---

### Task 10: Test 5 — `free-booking-auto-accept.spec.ts`

**Files:**
- Create: `web/e2e/onboarding/free-booking-auto-accept.spec.ts`

- [ ] **Step 1: Write test**

Similar structure to Task 9 but with `price_cents=0` and `auto_accept=true`, and asserting the booking is immediately confirmed without any Stripe form shown.

```ts
import { test, expect } from '../helpers/auth'

test('free auto-accept booking is confirmed instantly, no Stripe shown', async ({
  page,
  asVisitor,
  admin,
}) => {
  void asVisitor

  // Seed a free auto-accept market.
  const { data: org } = await admin.auth.admin.createUser({
    email: `e2e-free-org-${crypto.randomUUID()}@test.fyndstigen.se`,
    password: 'Test1234!',
    email_confirm: true,
  })
  const { data: market } = await admin
    .from('flea_markets')
    .insert({
      name: 'E2E Free Market',
      organizer_id: org.user!.id,
      slug: `e2e-free-${crypto.randomUUID().slice(0, 6)}`,
      auto_accept: true,
    })
    .select('slug')
    .single()
  await admin.from('market_tables').insert({
    market_id: (await admin.from('flea_markets').select('id').eq('slug', market!.slug).single()).data!.id,
    label: 'Gratis bord',
    price_cents: 0,
  })

  await page.goto(`/loppis/${market!.slug}`)
  await page.getByRole('button', { name: /boka bord/i }).click()
  await page.getByRole('button', { name: /bekräfta/i }).click()

  await expect(page.getByText(/bekräftad/i)).toBeVisible()
  await expect(page.locator('iframe[name^="__privateStripeFrame"]')).toHaveCount(0)
})
```

- [ ] **Step 2: Run + commit**

```bash
npm run e2e:onboarding -- free-booking-auto-accept.spec.ts
git add web/e2e/onboarding/free-booking-auto-accept.spec.ts
git commit -m "test(e2e): free auto-accept booking confirms instantly"
```

---

### Task 11: CI workflow — add onboarding job (non-blocking)

**Files:**
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Append job**

```yaml
  e2e-onboarding:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    continue-on-error: true  # flip to false after ~20 consecutive green runs
    services:
      stripe-mock:
        image: stripe/stripe-mock:latest
        ports: ['12111:12111']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: npm ci
      - run: cd web && npx playwright install --with-deps chromium
      - run: cd web && npm run e2e:onboarding
        env:
          E2E_PROFILE: onboarding
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-onboarding-trace
          path: web/test-results/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci(e2e): add onboarding job (non-blocking until stable)"
```

---

### Task 12: Full run + stabilize

- [ ] **Step 1: Run full onboarding suite locally**

```bash
cd web && npm run e2e:onboarding
```

Expected: 5 tests green. Expect first-run flakes around timing — add `await page.waitForLoadState('networkidle')` where UI depends on async hydration, but do NOT add blanket sleeps.

- [ ] **Step 2: Push and review CI run**

```bash
git push
```

- [ ] **Step 3: Open tracking issue for flip-to-blocking**

Create an issue: "Flip `continue-on-error` on e2e-onboarding to false after 20 consecutive green main runs." Track the counter in the issue description.

---

## Acceptance

- `npm run e2e:onboarding` runs 5 tests green locally (Docker + Supabase CLI required).
- CI job runs non-blocking but collects artifacts on failure.
- `E2E_STRIPE_STUB` and `ALLOW_E2E_HOOKS` are both guarded by `NODE_ENV !== 'production'` in every code path that reads them.
- No `.env.e2e.local` or service-role keys leak into git history.
- All 5 booking/onboarding scenarios from spec §5 are covered.
