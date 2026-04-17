# Skyltfönstret Payment Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** User requests review-agent AND security-agent after EVERY task. Both spec compliance and code quality reviews are mandatory, and security must be explicitly checked (Stripe keys, webhook signature verification, auth guards, no PII leaks).

**Goal:** Let organizers self-service upgrade to Skyltfönstret (69 kr/month) via Stripe Checkout, manage their subscription via Stripe Customer Portal, and automatically toggle `subscription_tier` via webhooks.

**Architecture:** Stripe Checkout Session for payment → webhook sets `subscription_tier = 1`. Stripe Customer Portal for management → webhook sets `subscription_tier = 0` on cancel. Two new edge functions (`skyltfonstret-checkout`, `skyltfonstret-portal`), extended webhook handler, one migration, two UI changes.

**Tech Stack:** Stripe Subscriptions, Stripe Checkout, Stripe Customer Portal, Supabase Edge Functions (Deno), Next.js, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-16-skyltfonstret-payment-design.md`

---

### Task 1: Database migration — add stripe_customer_id

**Files:**
- Create: `supabase/migrations/00009_skyltfonstret.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/00009_skyltfonstret.sql`:

```sql
-- Add Stripe Customer ID for Skyltfönstret subscription billing
ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;

-- Unique index so we can look up profiles by Stripe Customer ID in webhooks
CREATE UNIQUE INDEX profiles_stripe_customer_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00009_skyltfonstret.sql
git commit -m "feat: add stripe_customer_id column to profiles"
```

---

### Task 2: Edge function — skyltfonstret-checkout

**Files:**
- Create: `supabase/functions/skyltfonstret-checkout/index.ts`

- [ ] **Step 1: Create the checkout edge function**

Create `supabase/functions/skyltfonstret-checkout/index.ts`:

```typescript
import { createHandler, HttpError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, body, origin }) => {
  const priceId = Deno.env.get('SKYLTFONSTRET_PRICE_ID')
  if (!priceId) throw new Error('SKYLTFONSTRET_PRICE_ID is not set')

  // Get user profile
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) throw new HttpError(400, 'Profile not found')

  // Check if already premium
  const { data: tierCheck } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (tierCheck && tierCheck.subscription_tier >= 1) {
    throw new HttpError(400, 'Already subscribed to Skyltfönstret')
  }

  // Create or reuse Stripe Customer
  let customerId = profile.stripe_customer_id

  if (!customerId) {
    // Look up user email from auth
    const { data: { user: authUser } } = await admin.auth.admin.getUserById(user.id)
    const email = authUser?.email

    const customer = await stripe.customers.create({
      email: email || undefined,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id

    // Save to profile
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)

    if (updateErr) throw new Error('Failed to save Stripe customer ID')
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/profile/edit?skyltfonstret=active`,
    cancel_url: `${origin}/profile/edit`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  })

  if (!session.url) throw new Error('Failed to create checkout session')

  return { url: session.url }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/skyltfonstret-checkout/index.ts
git commit -m "feat: add skyltfonstret-checkout edge function"
```

---

### Task 3: Edge function — skyltfonstret-portal

**Files:**
- Create: `supabase/functions/skyltfonstret-portal/index.ts`

- [ ] **Step 1: Create the portal edge function**

Create `supabase/functions/skyltfonstret-portal/index.ts`:

```typescript
import { createHandler, HttpError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'

createHandler(async ({ user, admin, origin }) => {
  // Get user profile
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) throw new HttpError(400, 'Profile not found')

  if (!profile.stripe_customer_id) {
    throw new HttpError(400, 'No active subscription found')
  }

  // Create Billing Portal Session
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/profile/edit`,
  })

  return { url: session.url }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/skyltfonstret-portal/index.ts
git commit -m "feat: add skyltfonstret-portal edge function"
```

---

### Task 4: Extend stripe-webhooks with subscription events

**Files:**
- Modify: `supabase/functions/stripe-webhooks/index.ts`

- [ ] **Step 1: Add three new cases to the switch statement**

In `supabase/functions/stripe-webhooks/index.ts`, add these cases inside the `switch (event.type)` block, after the existing `payment_intent.succeeded` case (before the closing `}`):

```typescript
    case 'checkout.session.completed': {
      const session = event.data.object
      // Only handle subscription checkouts (not one-time payments)
      if (session.mode !== 'subscription') break

      // Get user_id from subscription metadata
      const userId = session.metadata?.user_id
        || session.subscription_data?.metadata?.user_id

      if (!userId) {
        // Try to find user by Stripe Customer ID
        const { data: profileByCustomer } = await admin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', session.customer)
          .single()
        if (profileByCustomer) {
          const { error } = await admin
            .from('profiles')
            .update({ subscription_tier: 1 })
            .eq('id', profileByCustomer.id)
          if (error) return new Response('DB error', { status: 500 })
        }
        break
      }

      const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: 1 })
        .eq('id', userId)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

      if (!customerId) break

      // Find profile by Stripe Customer ID and downgrade
      const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: 0 })
        .eq('stripe_customer_id', customerId)
      if (error) return new Response('DB error', { status: 500 })
      break
    }

    case 'invoice.payment_failed': {
      // Log for now — Stripe retries automatically
      const invoice = event.data.object
      console.warn(`Invoice payment failed: ${invoice.id}, customer: ${invoice.customer}`)
      break
    }
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhooks/index.ts
git commit -m "feat: handle subscription webhooks for Skyltfönstret"
```

---

### Task 5: Frontend — Skyltfönstret section on profile edit page

**Files:**
- Modify: `web/src/app/profile/edit/page.tsx`

- [ ] **Step 1: Add imports and state for checkout/portal**

At the top of `web/src/app/profile/edit/page.tsx`, add `useSearchParams` to the next/navigation import:

```typescript
import { useRouter, useSearchParams } from 'next/navigation'
```

Add `supabase` import:

```typescript
import { supabase } from '@/lib/supabase'
```

- [ ] **Step 2: Add upgrade/portal state and handlers**

Inside the `EditProfilePage` component, after the existing state declarations (after line 16 `const [saveError, setSaveError] = useState('')`), add:

```typescript
const searchParams = useSearchParams()
const [upgradeLoading, setUpgradeLoading] = useState(false)
const [showSuccess, setShowSuccess] = useState(false)

// Check for success redirect from Stripe Checkout
useEffect(() => {
  if (searchParams.get('skyltfonstret') === 'active') {
    setShowSuccess(true)
    router.replace('/profile/edit', { scroll: false })
    setTimeout(() => setShowSuccess(false), 5000)
  }
}, [searchParams, router])

async function handleUpgrade() {
  setUpgradeLoading(true)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await supabase.functions.invoke('skyltfonstret-checkout', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.error || !res.data?.url) throw new Error('Failed to create checkout')
    window.location.href = res.data.url
  } catch {
    setUpgradeLoading(false)
  }
}

async function handleManageSubscription() {
  setUpgradeLoading(true)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await supabase.functions.invoke('skyltfonstret-portal', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.error || !res.data?.url) throw new Error('Failed to create portal session')
    window.location.href = res.data.url
  } catch {
    setUpgradeLoading(false)
  }
}
```

- [ ] **Step 3: Replace the tier badge section**

Replace the existing "Tier badge" section (lines 96-116, the `vintage-card` with "Premium-arrangör" / "Gratis-arrangör") with:

```tsx
{/* Success banner */}
{showSuccess && (
  <div className="bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium mb-6 animate-fade-up">
    Skyltfönstret är aktiverat! Dina loppisar får nu bättre synlighet.
  </div>
)}

{/* Skyltfönstret */}
<div className="vintage-card p-6 mb-6">
  {isPremium ? (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="stamp text-mustard text-xs">Skyltfönstret</span>
        <span className="text-sm font-semibold">Aktivt</span>
      </div>
      <p className="text-sm text-espresso/60 mb-4">
        Dina loppisar har utökad SEO, detaljerad statistik och bättre synlighet på Google.
      </p>
      <button
        onClick={handleManageSubscription}
        disabled={upgradeLoading}
        className="text-sm text-rust hover:text-rust-light transition-colors disabled:opacity-50"
      >
        {upgradeLoading ? 'Laddar...' : 'Hantera prenumeration'}
      </button>
    </div>
  ) : (
    <div>
      <h3 className="font-display font-bold text-lg mb-2">Skyltfönstret</h3>
      <p className="text-sm text-espresso/70 mb-3">
        Ställ ut din loppis i Skyltfönstret och få tillgång till egen SEO, detaljerad statistik och mer synlighet.
      </p>
      <ul className="text-sm text-espresso/70 space-y-1 mb-4">
        <li>&#10003; Bättre synlighet på Google</li>
        <li>&#10003; Sidvisningar och konvertering</li>
        <li>&#10003; Statistik per loppis</li>
      </ul>
      <button
        onClick={handleUpgrade}
        disabled={upgradeLoading}
        className="h-11 px-6 rounded-xl bg-mustard text-white font-semibold text-sm hover:bg-mustard/90 transition-colors disabled:opacity-50 shadow-sm"
      >
        {upgradeLoading ? 'Laddar...' : 'Uppgradera — 69 kr/mån'}
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify types compile**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/app/profile/edit/page.tsx
git commit -m "feat: add Skyltfönstret upgrade/manage UI on profile edit page"
```

---

### Task 6: Frontend — Upgrade button in dashboard upsell banner

**Files:**
- Modify: `web/src/app/arrangorer/[id]/statistik/page.tsx`

- [ ] **Step 1: Add supabase import**

At the top of the file, add:

```typescript
import { supabase } from '@/lib/supabase'
```

- [ ] **Step 2: Add upgrade handler state and function**

Inside `OrganizerStatsPage`, after the existing `tierLoading` state declaration, add:

```typescript
const [upgradeLoading, setUpgradeLoading] = useState(false)

async function handleUpgrade() {
  setUpgradeLoading(true)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    const res = await supabase.functions.invoke('skyltfonstret-checkout', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.error || !res.data?.url) throw new Error('Failed to create checkout')
    window.location.href = res.data.url
  } catch {
    setUpgradeLoading(false)
  }
}
```

- [ ] **Step 3: Replace the upsell banner CTA**

In the Skyltfönstret upsell banner (the `!isPremium &&` block near the bottom), replace:

```tsx
<p className="text-xs text-espresso/50">Kontakta oss för att uppgradera.</p>
```

With:

```tsx
<button
  onClick={handleUpgrade}
  disabled={upgradeLoading}
  className="h-11 px-6 rounded-xl bg-mustard text-white font-semibold text-sm hover:bg-mustard/90 transition-colors disabled:opacity-50 shadow-sm"
>
  {upgradeLoading ? 'Laddar...' : 'Uppgradera — 69 kr/mån'}
</button>
```

- [ ] **Step 4: Verify types compile**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/src/app/arrangorer/[id]/statistik/page.tsx
git commit -m "feat: add upgrade button in dashboard upsell banner"
```

---

### Task 7: Update setup checklist

**Files:**
- Modify: `SETUP-CHECKLIST.txt`

- [ ] **Step 1: Add Skyltfönstret setup section**

Add after the PostHog Analytics section in `SETUP-CHECKLIST.txt`:

```
========================================================
7. SKYLTFÖNSTRET — Stripe Subscription
========================================================

7.1  Skapa en Stripe Price i Stripe Dashboard:
     - Produkt: "Skyltfönstret"
     - Pris: 69 SEK / månad (recurring)
     - Kopiera Price ID (price_...)

7.2  Sätt secrets i Supabase:

       supabase secrets set SKYLTFONSTRET_PRICE_ID=price_...

7.3  Lägg till webhook-events i Stripe Dashboard:
     Gå till samma webhook-endpoint som finns,
     och lägg till dessa events:
       - checkout.session.completed
       - customer.subscription.deleted
       - invoice.payment_failed

7.4  Konfigurera Stripe Customer Portal:
     Stripe Dashboard > Settings > Billing > Customer portal
     Aktivera: Cancel subscription, Update payment method

7.5  Deploya edge functions:

       npx supabase functions deploy skyltfonstret-checkout
       npx supabase functions deploy skyltfonstret-portal
       npx supabase functions deploy stripe-webhooks

7.6  Kör migration 00009_skyltfonstret.sql
```

- [ ] **Step 2: Commit**

```bash
git add SETUP-CHECKLIST.txt
git commit -m "docs: add Skyltfönstret Stripe setup to checklist"
```
