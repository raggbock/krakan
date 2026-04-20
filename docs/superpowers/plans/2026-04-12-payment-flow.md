# Payment Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe Connect payment processing to the existing table booking system — auth/hold at booking, capture on approval, auto-cancel expired holds.

**Architecture:** Supabase Edge Functions handle all Stripe operations (platform-agnostic for web + mobile). Frontend uses Stripe Elements for card input. A new `stripe_accounts` table tracks organizer Connect accounts. The existing `bookings` table gets three new columns for payment state.

**Tech Stack:** Stripe (Connect Standard, PaymentIntents with manual capture), Supabase Edge Functions (Deno), @stripe/react-stripe-js + @stripe/stripe-js (web frontend), pg_cron (auto-cancel)

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `supabase/migrations/00002_stripe_payment.sql` | New `stripe_accounts` table, `bookings` columns, RLS, indexes, cron job |
| `supabase/functions/stripe-connect-create/index.ts` | Create Stripe Connect account + Account Link |
| `supabase/functions/stripe-connect-status/index.ts` | Check organizer onboarding status |
| `supabase/functions/stripe-connect-refresh/index.ts` | Generate fresh Account Link |
| `supabase/functions/stripe-payment-create/index.ts` | Create PaymentIntent with manual capture |
| `supabase/functions/stripe-payment-capture/index.ts` | Capture held payment |
| `supabase/functions/stripe-payment-cancel/index.ts` | Cancel/release hold |
| `supabase/functions/stripe-webhooks/index.ts` | Handle Stripe webhook events |
| `supabase/functions/_shared/stripe.ts` | Shared Stripe client init + helpers |
| `supabase/functions/_shared/cors.ts` | CORS headers for edge functions |
| `supabase/functions/_shared/auth.ts` | JWT verification helper |
| `web/src/lib/stripe.ts` | Stripe.js init (publishable key) |
| `web/src/components/stripe-connect-button.tsx` | Onboarding button for organizers |
| `web/src/components/payment-card-form.tsx` | Stripe Elements card form |
| `web/src/hooks/use-stripe-connect.ts` | Hook for Connect onboarding state |

### Modified files

| File | Changes |
|---|---|
| `packages/shared/src/types.ts` | Add `StripeAccount`, `PaymentStatus` types, extend `Booking` |
| `web/package.json` | Add `@stripe/stripe-js`, `@stripe/react-stripe-js` |
| `web/src/components/bookable-tables-card.tsx` | Integrate payment card form into booking flow |
| `web/src/hooks/use-booking.ts` | Add payment intent creation + confirmation |
| `web/src/app/profile/page.tsx` | Add Stripe Connect section for organizers |
| `web/src/app/profile/bokningar/page.tsx` | Wire confirm/deny to capture/cancel edge functions |
| `web/src/app/profile/create-market/page.tsx` | Gate publish on `onboarding_complete` |

---

## Task 1: Database Migration — stripe_accounts table and bookings columns

**Files:**
- Create: `supabase/migrations/00002_stripe_payment.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Stripe Connect accounts for organizers
create table public.stripe_accounts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade unique,
  stripe_account_id text not null,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stripe_accounts_organizer_idx on public.stripe_accounts (organizer_id);

-- Updated_at trigger
create trigger stripe_accounts_updated_at before update on public.stripe_accounts
  for each row execute function public.update_updated_at();

-- RLS: organizers can read their own row
alter table public.stripe_accounts enable row level security;

create policy "Organizers can view own stripe account"
  on public.stripe_accounts for select
  using (auth.uid() = organizer_id);

-- Edge functions use service_role to insert/update, so no insert/update policies needed for users

-- Extend bookings table with payment columns
alter table public.bookings
  add column stripe_payment_intent_id text,
  add column payment_status text check (payment_status in ('requires_capture', 'captured', 'cancelled', 'failed')),
  add column expires_at timestamptz;

create index bookings_expires_idx on public.bookings (expires_at) where status = 'pending' and expires_at is not null;

-- Function to auto-cancel expired bookings (called by pg_cron)
create or replace function public.cancel_expired_bookings()
returns integer
language plpgsql security definer
as $$
declare
  cancelled_count integer;
begin
  update public.bookings
  set status = 'cancelled',
      payment_status = 'cancelled',
      updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();

  get diagnostics cancelled_count = row_count;
  return cancelled_count;
end;
$$;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` (or apply via Supabase dashboard)
Expected: Migration applies cleanly, new table and columns visible

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00002_stripe_payment.sql
git commit -m "feat: add stripe_accounts table and payment columns to bookings"
```

---

## Task 2: Shared Types — add payment types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add StripeAccount and PaymentStatus types**

Add the following after the `OrganizerStats` type block (after line 82):

```typescript
// --- Stripe ---

export type PaymentStatus = 'requires_capture' | 'captured' | 'cancelled' | 'failed'

export type StripeAccount = {
  id: string
  organizer_id: string
  stripe_account_id: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Extend Booking type with payment fields**

Update the `Booking` type to add the three new fields after `organizer_note`:

```typescript
export type Booking = {
  id: string
  market_table_id: string
  flea_market_id: string
  booked_by: string
  booking_date: string
  status: BookingStatus
  price_sek: number
  commission_sek: number
  commission_rate: number
  message: string | null
  organizer_note: string | null
  stripe_payment_intent_id: string | null
  payment_status: PaymentStatus | null
  expires_at: string | null
  created_at: string
}
```

- [ ] **Step 3: Export new types from web/src/lib/api.ts**

Add `StripeAccount` and `PaymentStatus` to the re-export list in `web/src/lib/api.ts`:

```typescript
export type {
  // ... existing exports ...
  StripeAccount,
  PaymentStatus,
} from '@fyndstigen/shared'
```

- [ ] **Step 4: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts web/src/lib/api.ts
git commit -m "feat: add Stripe payment types to shared package"
```

---

## Task 3: Edge Function Shared Utilities

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/stripe.ts`
- Create: `supabase/functions/_shared/auth.ts`

- [ ] **Step 1: Create CORS helper**

```typescript
// supabase/functions/_shared/cors.ts

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function corsResponse() {
  return new Response('ok', { headers: corsHeaders })
}
```

- [ ] **Step 2: Create Stripe client helper**

```typescript
// supabase/functions/_shared/stripe.ts

import Stripe from 'https://esm.sh/stripe@17?target=deno'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not set')

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-03-31.basil',
  httpClient: Stripe.createFetchHttpClient(),
})
```

- [ ] **Step 3: Create auth helper**

```typescript
// supabase/functions/_shared/auth.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
}

export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

export async function getUser(authHeader: string | null) {
  if (!authHeader) throw new Error('Missing authorization header')
  const supabase = getSupabaseClient(authHeader)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { user, supabase }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat: add shared edge function utilities (cors, stripe, auth)"
```

---

## Task 4: Stripe Connect — Create Account Edge Function

**Files:**
- Create: `supabase/functions/stripe-connect-create/index.ts`

- [ ] **Step 1: Write the edge function**

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()

    // Check if account already exists
    const { data: existing } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', user.id)
      .single()

    let stripeAccountId: string

    if (existing) {
      stripeAccountId = existing.stripe_account_id
    } else {
      // Create new Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'SE',
        email: user.email,
        metadata: { organizer_id: user.id },
      })
      stripeAccountId = account.id

      const { error: insertErr } = await admin
        .from('stripe_accounts')
        .insert({
          organizer_id: user.id,
          stripe_account_id: account.id,
        })
      if (insertErr) throw insertErr
    }

    // Generate Account Link for onboarding
    const { origin } = new URL(req.headers.get('origin') || req.url)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/profile?stripe=refresh`,
      return_url: `${origin}/profile?stripe=complete`,
      type: 'account_onboarding',
    })

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-connect-create/
git commit -m "feat: add stripe-connect-create edge function"
```

---

## Task 5: Stripe Connect — Status and Refresh Edge Functions

**Files:**
- Create: `supabase/functions/stripe-connect-status/index.ts`
- Create: `supabase/functions/stripe-connect-refresh/index.ts`

- [ ] **Step 1: Write the status function**

```typescript
// supabase/functions/stripe-connect-status/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()

    const { data } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', user.id)
      .single()

    return new Response(
      JSON.stringify({
        connected: !!data,
        onboarding_complete: data?.onboarding_complete ?? false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Write the refresh function**

```typescript
// supabase/functions/stripe-connect-refresh/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()

    const { data, error } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('organizer_id', user.id)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'No Stripe account found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { origin } = new URL(req.headers.get('origin') || req.url)
    const accountLink = await stripe.accountLinks.create({
      account: data.stripe_account_id,
      refresh_url: `${origin}/profile?stripe=refresh`,
      return_url: `${origin}/profile?stripe=complete`,
      type: 'account_onboarding',
    })

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-connect-status/ supabase/functions/stripe-connect-refresh/
git commit -m "feat: add stripe-connect-status and stripe-connect-refresh edge functions"
```

---

## Task 6: Stripe Payment — Create PaymentIntent Edge Function

**Files:**
- Create: `supabase/functions/stripe-payment-create/index.ts`

- [ ] **Step 1: Write the edge function**

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()
    const body = await req.json()
    const { marketTableId, fleaMarketId, bookingDate, message } = body as {
      marketTableId: string
      fleaMarketId: string
      bookingDate: string
      message?: string
    }

    // Get market table for price
    const { data: table, error: tableErr } = await admin
      .from('market_tables')
      .select('price_sek, flea_market_id')
      .eq('id', marketTableId)
      .single()
    if (tableErr || !table) throw new Error('Table not found')
    if (table.flea_market_id !== fleaMarketId) throw new Error('Table does not belong to market')

    // Get organizer's Stripe account
    const { data: market } = await admin
      .from('flea_markets')
      .select('organizer_id')
      .eq('id', fleaMarketId)
      .single()
    if (!market) throw new Error('Market not found')

    const { data: stripeAccount } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', market.organizer_id)
      .single()
    if (!stripeAccount?.onboarding_complete) throw new Error('Organizer has not completed Stripe setup')

    // Calculate amounts (in ore — Stripe uses smallest currency unit)
    const priceSek = table.price_sek
    const commissionRate = 0.12
    const commissionSek = Math.round(priceSek * commissionRate)
    const totalOre = (priceSek + commissionSek) * 100
    const applicationFeeOre = commissionSek * 100

    // Create PaymentIntent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalOre,
      currency: 'sek',
      capture_method: 'manual',
      application_fee_amount: applicationFeeOre,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata: {
        market_table_id: marketTableId,
        flea_market_id: fleaMarketId,
        booked_by: user.id,
        booking_date: bookingDate,
      },
    })

    // Create booking in DB
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .insert({
        market_table_id: marketTableId,
        flea_market_id: fleaMarketId,
        booked_by: user.id,
        booking_date: bookingDate,
        price_sek: priceSek,
        commission_sek: commissionSek,
        commission_rate: commissionRate,
        message: message || null,
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'requires_capture',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()
    if (bookingErr) throw bookingErr

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-payment-create/
git commit -m "feat: add stripe-payment-create edge function"
```

---

## Task 7: Stripe Payment — Capture and Cancel Edge Functions

**Files:**
- Create: `supabase/functions/stripe-payment-capture/index.ts`
- Create: `supabase/functions/stripe-payment-cancel/index.ts`

- [ ] **Step 1: Write the capture function**

```typescript
// supabase/functions/stripe-payment-capture/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()
    const { bookingId } = await req.json() as { bookingId: string }

    // Get booking and verify organizer owns the market
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('id, status, stripe_payment_intent_id, flea_market_id')
      .eq('id', bookingId)
      .single()
    if (bookingErr || !booking) throw new Error('Booking not found')
    if (booking.status !== 'pending') throw new Error('Booking is not pending')
    if (!booking.stripe_payment_intent_id) throw new Error('No payment intent for this booking')

    // Verify organizer
    const { data: market } = await admin
      .from('flea_markets')
      .select('organizer_id')
      .eq('id', booking.flea_market_id)
      .single()
    if (!market || market.organizer_id !== user.id) throw new Error('Not authorized')

    // Capture payment
    await stripe.paymentIntents.capture(booking.stripe_payment_intent_id)

    // Update booking status
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'captured',
      })
      .eq('id', bookingId)
    if (updateErr) throw updateErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Write the cancel function**

```typescript
// supabase/functions/stripe-payment-cancel/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { stripe } from '../_shared/stripe.ts'
import { getUser, getSupabaseAdmin } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { user } = await getUser(req.headers.get('Authorization'))
    const admin = getSupabaseAdmin()
    const { bookingId, newStatus } = await req.json() as {
      bookingId: string
      newStatus: 'denied' | 'cancelled'
    }

    // Get booking
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('id, status, stripe_payment_intent_id, flea_market_id, booked_by')
      .eq('id', bookingId)
      .single()
    if (bookingErr || !booking) throw new Error('Booking not found')
    if (booking.status !== 'pending') throw new Error('Booking is not pending')

    // Authorization: organizer can deny, booker can cancel
    if (newStatus === 'denied') {
      const { data: market } = await admin
        .from('flea_markets')
        .select('organizer_id')
        .eq('id', booking.flea_market_id)
        .single()
      if (!market || market.organizer_id !== user.id) throw new Error('Not authorized')
    } else if (newStatus === 'cancelled') {
      if (booking.booked_by !== user.id) throw new Error('Not authorized')
    } else {
      throw new Error('Invalid status')
    }

    // Cancel payment intent if exists
    if (booking.stripe_payment_intent_id) {
      await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
    }

    // Update booking
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        status: newStatus,
        payment_status: 'cancelled',
      })
      .eq('id', bookingId)
    if (updateErr) throw updateErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-payment-capture/ supabase/functions/stripe-payment-cancel/
git commit -m "feat: add stripe-payment-capture and stripe-payment-cancel edge functions"
```

---

## Task 8: Stripe Webhooks Edge Function

**Files:**
- Create: `supabase/functions/stripe-webhooks/index.ts`

- [ ] **Step 1: Write the webhook handler**

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { stripe } from '../_shared/stripe.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()
  let event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook Error: ${message}`, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object
      if (account.charges_enabled && account.details_submitted) {
        await admin
          .from('stripe_accounts')
          .update({ onboarding_complete: true })
          .eq('stripe_account_id', account.id)
      }
      break
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object
      await admin
        .from('bookings')
        .update({ payment_status: 'cancelled' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      await admin
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhooks/
git commit -m "feat: add stripe-webhooks edge function"
```

---

## Task 9: Frontend — Stripe.js Setup and Install Dependencies

**Files:**
- Modify: `web/package.json` (via yarn/npm)
- Create: `web/src/lib/stripe.ts`

- [ ] **Step 1: Install Stripe frontend packages**

Run: `cd web && yarn add @stripe/stripe-js @stripe/react-stripe-js`
Expected: Packages added to dependencies

- [ ] **Step 2: Create Stripe.js client**

```typescript
// web/src/lib/stripe.ts

import { loadStripe } from '@stripe/stripe-js'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null
```

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/yarn.lock web/src/lib/stripe.ts
git commit -m "feat: add Stripe.js frontend setup"
```

---

## Task 10: Frontend — Stripe Connect Button Component

**Files:**
- Create: `web/src/hooks/use-stripe-connect.ts`
- Create: `web/src/components/stripe-connect-button.tsx`

- [ ] **Step 1: Write the Connect hook**

```typescript
// web/src/hooks/use-stripe-connect.ts

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ConnectState = {
  connected: boolean
  onboardingComplete: boolean
  loading: boolean
  error: string | null
  startOnboarding: () => Promise<void>
  refreshOnboarding: () => Promise<void>
}

export function useStripeConnect(userId: string | undefined): ConnectState {
  const [connected, setConnected] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    checkStatus()
  }, [userId])

  async function checkStatus() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('stripe-connect-status', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw res.error
      setConnected(res.data.connected)
      setOnboardingComplete(res.data.onboarding_complete)
    } catch {
      setError('Kunde inte hämta Stripe-status')
    } finally {
      setLoading(false)
    }
  }

  async function startOnboarding() {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('stripe-connect-create', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw res.error
      window.location.href = res.data.url
    } catch {
      setError('Kunde inte starta Stripe-koppling')
    }
  }

  async function refreshOnboarding() {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('stripe-connect-refresh', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw res.error
      window.location.href = res.data.url
    } catch {
      setError('Kunde inte generera ny Stripe-länk')
    }
  }

  return { connected, onboardingComplete, loading, error, startOnboarding, refreshOnboarding }
}
```

- [ ] **Step 2: Write the Connect button component**

```typescript
// web/src/components/stripe-connect-button.tsx

'use client'

import { useStripeConnect } from '@/hooks/use-stripe-connect'

export function StripeConnectButton({ userId }: { userId: string | undefined }) {
  const connect = useStripeConnect(userId)

  if (connect.loading) {
    return (
      <div className="bg-parchment rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-cream-warm rounded w-1/3" />
      </div>
    )
  }

  if (connect.onboardingComplete) {
    return (
      <div className="flex items-center gap-2 bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Betalning kopplad
      </div>
    )
  }

  if (connect.connected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-mustard/10 text-mustard rounded-xl px-4 py-3 text-sm font-medium">
          Stripe-koppling påbörjad men ej slutförd
        </div>
        <button
          onClick={connect.refreshOnboarding}
          className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors"
        >
          Slutför koppling
        </button>
        {connect.error && <p className="text-xs text-error">{connect.error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-espresso/65">
        Koppla betalning för att kunna ta emot bokningar.
      </p>
      <button
        onClick={connect.startOnboarding}
        className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors"
      >
        Koppla betalning
      </button>
      {connect.error && <p className="text-xs text-error">{connect.error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/hooks/use-stripe-connect.ts web/src/components/stripe-connect-button.tsx
git commit -m "feat: add Stripe Connect onboarding UI"
```

---

## Task 11: Frontend — Payment Card Form Component

**Files:**
- Create: `web/src/components/payment-card-form.tsx`

- [ ] **Step 1: Write the card form component**

```typescript
// web/src/components/payment-card-form.tsx

'use client'

import { useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'

type PaymentCardFormProps = {
  onConfirm: (confirmPayment: () => Promise<{ error?: string }>) => void
  totalPrice: number
  commission: number
  isSubmitting: boolean
  canSubmit: boolean
  submitLabel?: string
}

function CardForm({ onConfirm, totalPrice, commission, isSubmitting, canSubmit, submitLabel }: PaymentCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)

  function handleSubmit() {
    if (!stripe || !elements) return

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) return

    onConfirm(async () => {
      // The parent will call this with the client secret
      return { error: undefined }
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-espresso/60 block mb-1">
          Kortuppgifter
        </label>
        <div className="rounded-lg bg-card px-3 py-2.5 border border-cream-warm focus-within:border-rust/40 transition-all">
          <CardElement
            onChange={(e) => {
              setCardComplete(e.complete)
              setCardError(e.error?.message ?? null)
            }}
            options={{
              style: {
                base: {
                  fontSize: '14px',
                  color: '#3D2B1F',
                  '::placeholder': { color: '#3D2B1F40' },
                },
                invalid: { color: '#C0392B' },
              },
            }}
          />
        </div>
        {cardError && <p className="text-xs text-error mt-1">{cardError}</p>}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-espresso/60">
          {totalPrice} kr (inkl {commission} kr avgift)
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || !cardComplete || !stripe || isSubmitting}
          className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors disabled:opacity-40"
        >
          {isSubmitting ? 'Behandlar...' : (submitLabel ?? 'Boka & reservera belopp')}
        </button>
      </div>
    </div>
  )
}

export function PaymentCardForm(props: PaymentCardFormProps) {
  if (!stripePromise) {
    return <p className="text-xs text-error">Stripe är inte konfigurerat</p>
  }

  return (
    <Elements stripe={stripePromise}>
      <CardForm {...props} />
    </Elements>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/payment-card-form.tsx
git commit -m "feat: add Stripe Elements payment card form"
```

---

## Task 12: Frontend — Update Booking Hook with Payment

**Files:**
- Modify: `web/src/hooks/use-booking.ts`

- [ ] **Step 1: Add payment intent handling to use-booking**

Replace the full contents of `web/src/hooks/use-booking.ts`:

```typescript
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { api, MarketTable } from '@/lib/api'
import { calculateCommission, COMMISSION_RATE, validateBookingDate } from '@fyndstigen/shared'
import { supabase } from '@/lib/supabase'

type DateValidation = { valid: boolean; error?: string }

type BookingHook = {
  // State
  selectedTable: MarketTable | null
  date: string
  message: string
  bookedDates: string[]

  // Setters
  selectTable: (table: MarketTable | null) => void
  setDate: (date: string) => void
  setMessage: (msg: string) => void

  // Computed
  dateValidation: DateValidation
  commission: number
  totalPrice: number
  canSubmit: boolean

  // Mutation
  submit: () => Promise<void>
  isSubmitting: boolean
  isDone: boolean
  submitError: string | null
  reset: () => void
}

export function useBooking(marketId: string, userId: string | undefined): BookingHook {
  const stripe = useStripe()
  const elements = useElements()
  const [selectedTable, setSelectedTable] = useState<MarketTable | null>(null)
  const [date, setDate] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookedDates, setBookedDates] = useState<string[]>([])

  // Fetch booked dates when table changes
  useEffect(() => {
    if (!selectedTable) {
      setBookedDates([])
      return
    }
    api.bookings.availableDates(selectedTable.id).then(setBookedDates).catch(() => setBookedDates([]))
  }, [selectedTable?.id])

  // Computed: date validation
  const today = new Date().toISOString().slice(0, 10)
  const dateValidation = useMemo<DateValidation>(() => {
    if (!date) return { valid: false }
    return validateBookingDate(date, bookedDates, today)
  }, [date, bookedDates, today])

  // Computed: pricing
  const price = selectedTable?.price_sek ?? 0
  const commission = calculateCommission(price, COMMISSION_RATE)
  const totalPrice = price + commission

  // Computed: can submit
  const canSubmit = !!selectedTable && !!date && dateValidation.valid && !!userId && !isSubmitting

  const submit = useCallback(async () => {
    if (!canSubmit || !selectedTable || !stripe || !elements) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // 1. Create PaymentIntent via edge function
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('stripe-payment-create', {
        body: {
          marketTableId: selectedTable.id,
          fleaMarketId: marketId,
          bookingDate: date,
          message: message || undefined,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message || 'Failed to create payment')
      const { clientSecret } = res.data

      // 2. Confirm card payment (creates the hold)
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not found')

      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      })
      if (confirmError) throw new Error(confirmError.message)

      setIsDone(true)
      setSelectedTable(null)
      setDate('')
      setMessage('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.')
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, selectedTable, stripe, elements, marketId, date, message])

  function reset() {
    setSelectedTable(null)
    setDate('')
    setMessage('')
    setIsSubmitting(false)
    setIsDone(false)
    setSubmitError(null)
    setBookedDates([])
  }

  return {
    selectedTable,
    date,
    message,
    bookedDates,
    selectTable: setSelectedTable,
    setDate,
    setMessage,
    dateValidation,
    commission,
    totalPrice,
    canSubmit,
    submit,
    isSubmitting,
    isDone,
    submitError,
    reset,
  }
}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/use-booking.ts
git commit -m "feat: integrate Stripe payment into booking hook"
```

---

## Task 13: Frontend — Update BookableTablesCard with Stripe Elements

**Files:**
- Modify: `web/src/components/bookable-tables-card.tsx`

- [ ] **Step 1: Wrap component with Stripe Elements provider and add card input**

Replace the full contents of `web/src/components/bookable-tables-card.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { Elements, CardElement } from '@stripe/react-stripe-js'
import type { MarketTable } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useBooking } from '@/hooks/use-booking'
import { stripePromise } from '@/lib/stripe'

function BookableTablesInner({
  fleaMarketId,
  tables,
}: {
  fleaMarketId: string
  tables: MarketTable[]
}) {
  const { user } = useAuth()
  const booking = useBooking(fleaMarketId, user?.id)

  return (
    <div className="vintage-card p-6 animate-fade-up delay-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-lavender/15 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-lavender">
            <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="4" y1="11" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="11" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg mb-1">Boka bord</h2>
          <p className="text-sm text-espresso/65 mb-4">
            Hyr en plats och sälj dina prylar här.
          </p>

          {booking.isDone && (
            <div className="bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium mb-4">
              Bokning skickad! Beloppet är reserverat tills arrangören svarar.
            </div>
          )}

          <div className="space-y-3">
            {tables.map((table) => {
              const isSelected = booking.selectedTable?.id === table.id
              return (
                <div key={table.id}>
                  <button
                    onClick={() => booking.selectTable(isSelected ? null : table)}
                    className={`w-full text-left flex items-center justify-between rounded-xl p-4 transition-all ${
                      isSelected
                        ? 'bg-rust/8 border border-rust/20'
                        : 'bg-parchment hover:bg-cream-warm border border-transparent'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{table.label}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-espresso/60">
                        {table.size_description && <span>{table.size_description}</span>}
                        {table.description && <span>&middot; {table.description}</span>}
                      </div>
                    </div>
                    <span className="font-display font-bold text-rust">
                      {table.price_sek} kr
                    </span>
                  </button>

                  {isSelected && (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-rust/15 space-y-3 animate-fade-in">
                      <div>
                        <label className="text-xs font-semibold text-espresso/60 block mb-1">
                          Datum
                        </label>
                        <input
                          type="date"
                          value={booking.date}
                          onChange={(e) => booking.setDate(e.target.value)}
                          className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
                        />
                        {booking.date && booking.dateValidation.error && (
                          <p className="text-xs text-error mt-1">
                            {booking.dateValidation.error}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-espresso/60 block mb-1">
                          Meddelande (valfritt)
                        </label>
                        <textarea
                          value={booking.message}
                          onChange={(e) => booking.setMessage(e.target.value)}
                          rows={2}
                          placeholder="Berätta vad du säljer..."
                          className="w-full rounded-lg bg-card px-3 py-2 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none placeholder:text-espresso/25"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-espresso/60 block mb-1">
                          Kortuppgifter
                        </label>
                        <div className="rounded-lg bg-card px-3 py-2.5 border border-cream-warm focus-within:border-rust/40 transition-all">
                          <CardElement
                            options={{
                              style: {
                                base: {
                                  fontSize: '14px',
                                  color: '#3D2B1F',
                                  '::placeholder': { color: '#3D2B1F40' },
                                },
                                invalid: { color: '#C0392B' },
                              },
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-espresso/60">
                          {booking.totalPrice} kr (inkl {booking.commission} kr avgift)
                        </p>
                        {user ? (
                          <button
                            onClick={booking.submit}
                            disabled={!booking.canSubmit}
                            className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors disabled:opacity-40"
                          >
                            {booking.isSubmitting ? 'Behandlar...' : 'Boka & reservera'}
                          </button>
                        ) : (
                          <Link href="/auth" className="text-rust text-xs font-semibold">
                            Logga in för att boka
                          </Link>
                        )}
                      </div>
                      {booking.submitError && (
                        <p className="text-xs text-error">{booking.submitError}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BookableTablesCard({
  fleaMarketId,
  tables,
}: {
  fleaMarketId: string
  tables: MarketTable[]
}) {
  if (!stripePromise) {
    return (
      <BookableTablesInner fleaMarketId={fleaMarketId} tables={tables} />
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <BookableTablesInner fleaMarketId={fleaMarketId} tables={tables} />
    </Elements>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/bookable-tables-card.tsx
git commit -m "feat: integrate Stripe Elements into booking card"
```

---

## Task 14: Frontend — Add Stripe Connect to Profile Page

**Files:**
- Modify: `web/src/app/profile/page.tsx`

- [ ] **Step 1: Add Stripe Connect section**

Add import at top of `web/src/app/profile/page.tsx`:

```typescript
import { StripeConnectButton } from '@/components/stripe-connect-button'
```

Add the following section after the profile header card (after line 81, after the closing `</div>` of the profile header vintage-card), before the "My markets" section:

```typescript
      {/* Stripe Connect */}
      <div className="vintage-card p-8 mb-6 animate-fade-up delay-1">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-forest/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-forest">
              <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="1" y1="7.5" x2="15" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-lg mb-1">Betalning</h2>
            <StripeConnectButton userId={user?.id} />
          </div>
        </div>
      </div>
```

Also update the animation delays on the subsequent cards: "Mina loppisar" card change `delay-1` to `delay-2`, "Mina rundor" card change `delay-2` to `delay-3`, "Skapa en loppis" card change `delay-3` to `delay-4`, and the sign out button change `delay-3` to `delay-4`.

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/profile/page.tsx
git commit -m "feat: add Stripe Connect section to profile page"
```

---

## Task 15: Frontend — Wire Organizer Approve/Deny to Edge Functions

**Files:**
- Modify: `web/src/app/profile/bokningar/page.tsx`

- [ ] **Step 1: Update handleUpdateStatus to call edge functions**

Replace the `handleUpdateStatus` function (lines 49-63) with:

```typescript
  async function handleUpdateStatus(
    bookingId: string,
    status: 'confirmed' | 'denied',
  ) {
    setUpdatingId(bookingId)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}` }

      if (status === 'confirmed') {
        const res = await (await import('@/lib/supabase')).supabase.functions.invoke('stripe-payment-capture', {
          body: { bookingId },
          headers,
        })
        if (res.error) throw new Error(res.data?.error || 'Capture failed')
      } else {
        const res = await (await import('@/lib/supabase')).supabase.functions.invoke('stripe-payment-cancel', {
          body: { bookingId, newStatus: 'denied' },
          headers,
        })
        if (res.error) throw new Error(res.data?.error || 'Cancel failed')
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setUpdatingId(null)
    }
  }
```

Also add the `supabase` import at the top:

```typescript
import { supabase } from '@/lib/supabase'
```

And then simplify the `handleUpdateStatus` to use it directly (remove the dynamic imports):

```typescript
  async function handleUpdateStatus(
    bookingId: string,
    status: 'confirmed' | 'denied',
  ) {
    setUpdatingId(bookingId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}` }

      if (status === 'confirmed') {
        const res = await supabase.functions.invoke('stripe-payment-capture', {
          body: { bookingId },
          headers,
        })
        if (res.error) throw new Error(res.data?.error || 'Capture failed')
      } else {
        const res = await supabase.functions.invoke('stripe-payment-cancel', {
          body: { bookingId, newStatus: 'denied' },
          headers,
        })
        if (res.error) throw new Error(res.data?.error || 'Cancel failed')
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setUpdatingId(null)
    }
  }
```

- [ ] **Step 2: Add payment status badge to BookingCard**

In the `BookingCard` component, add a payment badge after the status label (around line 204):

After this line:
```typescript
            <span className={`stamp text-xs ${statusColors[booking.status]}`}>
              {statusLabels[booking.status]}
            </span>
```

Add:
```typescript
            {booking.payment_status && (
              <span className="text-xs text-espresso/30">
                {booking.payment_status === 'requires_capture' && '(reserverat)'}
                {booking.payment_status === 'captured' && '(betald)'}
                {booking.payment_status === 'cancelled' && '(återbetald)'}
                {booking.payment_status === 'failed' && '(misslyckad)'}
              </span>
            )}
```

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/app/profile/bokningar/page.tsx
git commit -m "feat: wire approve/deny to Stripe capture/cancel edge functions"
```

---

## Task 16: Frontend — Gate Market Publishing on Stripe Connect

**Files:**
- Modify: `web/src/app/profile/create-market/page.tsx`

- [ ] **Step 1: Read the current file to find the publish logic**

Read `web/src/app/profile/create-market/page.tsx` fully to understand the current publish flow and where to add the gate.

- [ ] **Step 2: Add Stripe Connect check before publish**

This depends on the file's structure, but the approach is:
1. Import `useStripeConnect` hook
2. Before the publish step, check `connect.onboardingComplete`
3. If not complete, show a message: "Koppla betalning i din profil innan du kan publicera"
4. Disable the publish/submit button

The exact implementation will depend on the file structure found in step 1.

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/app/profile/create-market/page.tsx
git commit -m "feat: gate market publishing on Stripe Connect onboarding"
```

---

## Task 17: Environment Variables and Deployment Config

**Files:**
- Modify: `web/.env.example`

- [ ] **Step 1: Add Stripe env vars to .env.example**

Add the following to `web/.env.example`:

```
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 2: Add Stripe secrets to Supabase Edge Function config**

The following secrets need to be set in Supabase (via dashboard or CLI):
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret

Run: `npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...`

- [ ] **Step 3: Update wrangler.staging.jsonc with Stripe publishable key**

Add to the `vars` object in `web/wrangler.staging.jsonc`:

```json
"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_..."
```

- [ ] **Step 4: Commit (env example only — no secrets)**

```bash
git add web/.env.example
git commit -m "chore: add Stripe env vars to .env.example"
```

---

## Task 18: Enable pg_cron for Auto-Cancel

- [ ] **Step 1: Enable pg_cron in Supabase**

Via Supabase dashboard: Database > Extensions > Enable `pg_cron`

Or add to migration:

```sql
-- Note: pg_cron must be enabled via Supabase dashboard first
-- Then schedule the job:
select cron.schedule(
  'cancel-expired-bookings',
  '0 3 * * *',  -- Run daily at 03:00 UTC
  $$select public.cancel_expired_bookings()$$
);
```

- [ ] **Step 2: The cancel_expired_bookings function only updates DB status**

Note: The DB function cancels booking status but does NOT cancel the Stripe PaymentIntent. For the MVP, expired holds auto-release in Stripe after 7 days anyway. A future improvement would be to call the Stripe API from an edge function instead of pg_cron.

- [ ] **Step 3: Commit if migration updated**

```bash
git add supabase/migrations/00002_stripe_payment.sql
git commit -m "feat: add pg_cron schedule for expired booking cleanup"
```

---

## Task 19: Cleanup — Remove Standalone PaymentCardForm

**Files:**
- Delete: `web/src/components/payment-card-form.tsx`

- [ ] **Step 1: Delete the standalone component**

The `PaymentCardForm` from Task 11 was superseded by the inline `CardElement` in `BookableTablesCard` (Task 13). Delete it to avoid confusion.

Run: `rm web/src/components/payment-card-form.tsx`

- [ ] **Step 2: Commit**

```bash
git add -u web/src/components/payment-card-form.tsx
git commit -m "chore: remove unused standalone payment card form"
```

---

## Summary

| Task | Description |
|---|---|
| 1 | Database migration — stripe_accounts + bookings columns |
| 2 | Shared types — PaymentStatus, StripeAccount |
| 3 | Edge function shared utilities (cors, stripe, auth) |
| 4 | Edge function: stripe-connect-create |
| 5 | Edge functions: stripe-connect-status + refresh |
| 6 | Edge function: stripe-payment-create |
| 7 | Edge functions: stripe-payment-capture + cancel |
| 8 | Edge function: stripe-webhooks |
| 9 | Frontend: Stripe.js setup + install deps |
| 10 | Frontend: Stripe Connect button + hook |
| 11 | Frontend: Payment card form component |
| 12 | Frontend: Update booking hook with payment |
| 13 | Frontend: Update BookableTablesCard with Stripe Elements |
| 14 | Frontend: Add Stripe Connect to profile page |
| 15 | Frontend: Wire approve/deny to edge functions |
| 16 | Frontend: Gate market publish on Stripe onboarding |
| 17 | Environment variables and deployment config |
| 18 | Enable pg_cron for auto-cancel |
| 19 | Cleanup: remove unused standalone component |
