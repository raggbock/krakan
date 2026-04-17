# Skyltfönstret Payment Flow — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

Add a self-service payment flow for organizers to upgrade to "Skyltfönstret" (premium tier) at 69 kr/month. Uses Stripe Checkout for payment, Stripe Customer Portal for subscription management, and webhooks to toggle `subscription_tier` on the profile.

## Scope

**In scope:**
- Migration: add `stripe_customer_id` column to profiles
- Edge function: `skyltfonstret-checkout` — creates Stripe Customer + Checkout Session
- Edge function: `skyltfonstret-portal` — creates Stripe Billing Portal Session
- Extend `stripe-webhooks` to handle subscription events
- Frontend: upgrade section on `/profile/edit`
- Frontend: upgrade button in dashboard upsell banner
- Success state after returning from Checkout

**Out of scope:**
- Free trial period
- Multiple tiers / plan selection
- Annual billing (can be added later via Stripe Price)
- Custom cancellation flow (Stripe Customer Portal handles this)

## Part 1: Database Migration

New migration `00009_skyltfonstret.sql`:

```sql
ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;
CREATE UNIQUE INDEX profiles_stripe_customer_idx ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

No new tables. `subscription_tier` (0=free, 1=premium) already exists on profiles.

## Part 2: Edge Function — `skyltfonstret-checkout`

**Endpoint:** `POST /skyltfonstret-checkout`

**Auth:** Requires JWT.

**Flow:**
1. Get user's profile from Supabase (need `stripe_customer_id`, `first_name`, `last_name`)
2. If no `stripe_customer_id`:
   - Create a Stripe Customer with the user's email and name
   - Save `stripe_customer_id` to the profile
3. Create a Stripe Checkout Session:
   - `mode: 'subscription'`
   - `customer`: the Stripe Customer ID
   - `line_items: [{ price: SKYLTFONSTRET_PRICE_ID, quantity: 1 }]`
   - `success_url: {origin}/profile/edit?skyltfonstret=active`
   - `cancel_url: {origin}/profile/edit`
   - `subscription_data.metadata: { user_id: user.id }`
4. Return `{ url: session.url }`

**Env vars:**
- `SKYLTFONSTRET_PRICE_ID` — Stripe Price ID created in Stripe Dashboard (recurring, 69 SEK/month)

Uses `createHandler()` from `_shared/handler.ts`. Uses `stripe` from `_shared/stripe.ts`.

## Part 3: Edge Function — `skyltfonstret-portal`

**Endpoint:** `POST /skyltfonstret-portal`

**Auth:** Requires JWT.

**Flow:**
1. Get user's profile, read `stripe_customer_id`
2. If no `stripe_customer_id`, throw error (user has never subscribed)
3. Create a Stripe Billing Portal Session:
   - `customer`: the Stripe Customer ID
   - `return_url: {origin}/profile/edit`
4. Return `{ url: session.url }`

## Part 4: Webhook Extensions

**File:** `supabase/functions/stripe-webhooks/index.ts`

Add handlers for three new event types (in addition to existing handlers):

### `checkout.session.completed`
- Check `session.mode === 'subscription'`
- Read `user_id` from `session.subscription_data?.metadata` or `session.metadata`
- Set `subscription_tier = 1` on the user's profile

### `customer.subscription.deleted`
- Read customer ID from event
- Find profile with matching `stripe_customer_id`
- Set `subscription_tier = 0`

### `invoice.payment_failed`
- Log the event for now (no automatic downgrade on first failure — Stripe retries)

**Stripe Dashboard config:** Add these event types to the existing webhook endpoint:
- `checkout.session.completed`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Part 5: Frontend — Profile Edit Page

**File:** `web/src/app/profile/edit/page.tsx`

Add a "Skyltfönstret" section after existing profile fields:

**Free tier (`subscription_tier === 0`):**
- Card with Skyltfönstret branding
- List of benefits (SEO, statistik, synlighet)
- "Uppgradera — 69 kr/mån" button
- Button click → call `skyltfonstret-checkout` edge function → `window.location.href = url`

**Premium tier (`subscription_tier >= 1`):**
- Card with "Du har Skyltfönstret" badge
- "Hantera prenumeration" button
- Button click → call `skyltfonstret-portal` edge function → `window.location.href = url`

**Success state:**
- If URL has `?skyltfonstret=active`, show a green success banner: "Skyltfönstret är aktiverat!"
- Remove the query param from URL after showing (using `router.replace`)

## Part 6: Frontend — Dashboard Upsell Button

**File:** `web/src/app/arrangorer/[id]/statistik/page.tsx`

In the existing upsell banner (free-tier only), replace `<p className="text-xs text-espresso/50">Kontakta oss för att uppgradera.</p>` with an "Uppgradera — 69 kr/mån" button that calls `skyltfonstret-checkout` and redirects.

## Files to Create/Modify

**New files:**
- `supabase/migrations/00009_skyltfonstret.sql`
- `supabase/functions/skyltfonstret-checkout/index.ts`
- `supabase/functions/skyltfonstret-portal/index.ts`

**Modified files:**
- `supabase/functions/stripe-webhooks/index.ts` — new event handlers
- `web/src/app/profile/edit/page.tsx` — Skyltfönstret section
- `web/src/app/arrangorer/[id]/statistik/page.tsx` — upgrade button in upsell banner
- `SETUP-CHECKLIST.txt` — document new env vars and Stripe Dashboard config
