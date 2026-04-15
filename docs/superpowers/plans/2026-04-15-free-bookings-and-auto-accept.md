# Free Bookings, Auto-Accept & Optional Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow organizers to offer free tables without Stripe, and auto-accept bookings so they confirm instantly without manual approval.

**Architecture:** Add `auto_accept_bookings` to `flea_markets`, extend `PaymentStatus` with `'free'`, refactor the single `stripe-payment-create` edge function into `booking-create` with branching logic (free vs paid, auto vs manual), and update the client hook to conditionally show Stripe Elements.

**Tech Stack:** Supabase (Postgres migrations, Edge Functions/Deno), Stripe Connect, Next.js, React, TypeScript, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/00005_auto_accept_and_free_bookings.sql` | DB migration |
| Modify | `packages/shared/src/types.ts` | Add `auto_accept_bookings` to FleaMarket, `'free'` to PaymentStatus |
| Modify | `packages/shared/src/booking.ts` | Add `isFreePriced()` and `resolveBookingOutcome()` helpers |
| Create | `packages/shared/src/booking.test.ts` | Tests for new booking helpers |
| Create | `supabase/functions/booking-create/index.ts` | New unified booking endpoint |
| Modify | `supabase/functions/_shared/pricing.ts` | Add `isFreePriced()` mirror |
| Modify | `supabase/functions/stripe-webhooks/index.ts` | Handle `payment_intent.succeeded` for auto-accept |
| Modify | `supabase/functions/stripe-payment-capture/index.ts` | Handle free bookings (no PI) |
| Modify | `supabase/functions/stripe-payment-cancel/index.ts` | Handle free bookings (no PI) |
| Modify | `web/src/hooks/use-booking.ts` | Conditional Stripe flow |
| Modify | `web/src/hooks/use-booking.test.ts` | Tests for free/auto-accept paths |
| Modify | `web/src/app/profile/create-market/page.tsx` | Auto-accept toggle, allow free tables, conditional Stripe gate |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00005_auto_accept_and_free_bookings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add auto-accept toggle to flea markets
alter table public.flea_markets
  add column auto_accept_bookings boolean not null default false;

-- Allow price 0 as default for market tables
alter table public.market_tables
  alter column price_sek set default 0;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase migration up` (or use MCP `apply_migration` tool)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00005_auto_accept_and_free_bookings.sql
git commit -m "feat: add auto_accept_bookings column and default price 0"
```

---

### Task 2: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add `'free'` to PaymentStatus**

In `packages/shared/src/types.ts`, change line 96:

```typescript
// Before:
export type PaymentStatus = 'requires_capture' | 'captured' | 'cancelled' | 'failed'

// After:
export type PaymentStatus = 'requires_capture' | 'requires_payment' | 'captured' | 'cancelled' | 'failed' | 'free'
```

- [ ] **Step 2: Add `auto_accept_bookings` to FleaMarket type**

In `packages/shared/src/types.ts`, add to the `FleaMarket` type (after `organizer_id`):

```typescript
export type FleaMarket = {
  id: string
  name: string
  description: string
  street: string
  zip_code: string
  city: string
  country: string
  is_permanent: boolean
  latitude: number
  longitude: number
  published_at: string | null
  organizer_id: string
  auto_accept_bookings: boolean  // <-- add this
  created_at: string
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add free/requires_payment to PaymentStatus, auto_accept_bookings to FleaMarket"
```

---

### Task 3: Add Booking Helpers (TDD)

**Files:**
- Create: `packages/shared/src/booking.test.ts`
- Modify: `packages/shared/src/booking.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/booking.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  isFreePriced,
  resolveBookingOutcome,
  calculateStripeAmounts,
  calculateCommission,
  COMMISSION_RATE,
} from './booking'

describe('isFreePriced', () => {
  it('returns true for price 0', () => {
    expect(isFreePriced(0)).toBe(true)
  })

  it('returns false for price > 0', () => {
    expect(isFreePriced(100)).toBe(false)
  })
})

describe('resolveBookingOutcome', () => {
  it('free + auto-accept → confirmed/free, no stripe', () => {
    const result = resolveBookingOutcome(0, true)
    expect(result).toEqual({
      status: 'confirmed',
      paymentStatus: 'free',
      needsStripe: false,
      captureMethod: null,
      expiresAt: null,
    })
  })

  it('free + manual → pending/free, no stripe, has expiry', () => {
    const result = resolveBookingOutcome(0, false)
    expect(result.status).toBe('pending')
    expect(result.paymentStatus).toBe('free')
    expect(result.needsStripe).toBe(false)
    expect(result.captureMethod).toBeNull()
    expect(result.expiresAt).not.toBeNull()
  })

  it('paid + auto-accept → pending/requires_payment, stripe automatic', () => {
    const result = resolveBookingOutcome(200, true)
    expect(result).toEqual({
      status: 'pending',
      paymentStatus: 'requires_payment',
      needsStripe: true,
      captureMethod: 'automatic',
      expiresAt: null,
    })
  })

  it('paid + manual → pending/requires_capture, stripe manual, has expiry', () => {
    const result = resolveBookingOutcome(200, false)
    expect(result.status).toBe('pending')
    expect(result.paymentStatus).toBe('requires_capture')
    expect(result.needsStripe).toBe(true)
    expect(result.captureMethod).toBe('manual')
    expect(result.expiresAt).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && npx vitest run src/booking.test.ts`
Expected: FAIL — `isFreePriced` and `resolveBookingOutcome` not exported

- [ ] **Step 3: Implement helpers**

Add to `packages/shared/src/booking.ts`:

```typescript
export function isFreePriced(priceSek: number): boolean {
  return priceSek === 0
}

type BookingOutcome = {
  status: 'pending' | 'confirmed'
  paymentStatus: 'free' | 'requires_payment' | 'requires_capture'
  needsStripe: boolean
  captureMethod: 'automatic' | 'manual' | null
  expiresAt: string | null
}

export function resolveBookingOutcome(priceSek: number, autoAccept: boolean): BookingOutcome {
  const free = isFreePriced(priceSek)

  if (free && autoAccept) {
    return { status: 'confirmed', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: null }
  }

  if (free && !autoAccept) {
    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    return { status: 'pending', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: expires.toISOString() }
  }

  if (!free && autoAccept) {
    return { status: 'pending', paymentStatus: 'requires_payment', needsStripe: true, captureMethod: 'automatic', expiresAt: null }
  }

  // paid + manual
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return { status: 'pending', paymentStatus: 'requires_capture', needsStripe: true, captureMethod: 'manual', expiresAt: expires.toISOString() }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run src/booking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/booking.ts packages/shared/src/booking.test.ts
git commit -m "feat: add isFreePriced and resolveBookingOutcome helpers with tests"
```

---

### Task 4: Mirror Helpers in Edge Function Shared

**Files:**
- Modify: `supabase/functions/_shared/pricing.ts`

- [ ] **Step 1: Add mirrored helpers**

Add to `supabase/functions/_shared/pricing.ts` (after existing functions):

```typescript
export function isFreePriced(priceSek: number): boolean {
  return priceSek === 0
}

type BookingOutcome = {
  status: 'pending' | 'confirmed'
  paymentStatus: 'free' | 'requires_payment' | 'requires_capture'
  needsStripe: boolean
  captureMethod: 'automatic' | 'manual' | null
  expiresAt: string | null
}

export function resolveBookingOutcome(priceSek: number, autoAccept: boolean): BookingOutcome {
  const free = isFreePriced(priceSek)

  if (free && autoAccept) {
    return { status: 'confirmed', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: null }
  }

  if (free && !autoAccept) {
    const expires = new Date()
    expires.setDate(expires.getDate() + 7)
    return { status: 'pending', paymentStatus: 'free', needsStripe: false, captureMethod: null, expiresAt: expires.toISOString() }
  }

  if (!free && autoAccept) {
    return { status: 'pending', paymentStatus: 'requires_payment', needsStripe: true, captureMethod: 'automatic', expiresAt: null }
  }

  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return { status: 'pending', paymentStatus: 'requires_capture', needsStripe: true, captureMethod: 'manual', expiresAt: expires.toISOString() }
}
```

Update the doc comment at the top to mention the new functions.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/pricing.ts
git commit -m "feat: mirror isFreePriced and resolveBookingOutcome in edge function shared"
```

---

### Task 5: Create `booking-create` Edge Function

**Files:**
- Create: `supabase/functions/booking-create/index.ts`

- [ ] **Step 1: Create the new edge function**

Create `supabase/functions/booking-create/index.ts`:

```typescript
import { createHandler, NotFoundError } from '../_shared/handler.ts'
import { stripe } from '../_shared/stripe.ts'
import { calculateStripeAmounts, resolveBookingOutcome } from '../_shared/pricing.ts'

createHandler(async ({ user, admin, body }) => {
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
  if (tableErr || !table) throw new NotFoundError('Table not found')
  if (table.flea_market_id !== fleaMarketId) throw new Error('Table does not belong to market')

  // Get market for auto_accept and organizer
  const { data: market } = await admin
    .from('flea_markets')
    .select('organizer_id, auto_accept_bookings')
    .eq('id', fleaMarketId)
    .single()
  if (!market) throw new NotFoundError('Market not found')

  // Resolve what kind of booking this is
  const outcome = resolveBookingOutcome(table.price_sek, market.auto_accept_bookings)

  // If paid, require Stripe account
  let stripeAccountId: string | null = null
  if (outcome.needsStripe) {
    const { data: stripeAccount } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('organizer_id', market.organizer_id)
      .single()
    if (!stripeAccount?.onboarding_complete) {
      throw new Error('Organizer has not completed Stripe setup')
    }
    stripeAccountId = stripeAccount.stripe_account_id
  }

  // Idempotency: check for existing pending/confirmed booking
  const { data: existingBooking } = await admin
    .from('bookings')
    .select('id')
    .eq('market_table_id', marketTableId)
    .eq('booked_by', user.id)
    .eq('booking_date', bookingDate)
    .in('status', ['pending', 'confirmed'])
    .single()
  if (existingBooking) throw new Error('Du har redan en bokning för detta bord och datum')

  // Calculate amounts
  const { priceSek, commissionSek, commissionRate } = calculateStripeAmounts(table.price_sek)

  // Create PaymentIntent if needed
  let paymentIntentId: string | null = null
  let clientSecret: string | null = null

  if (outcome.needsStripe && stripeAccountId) {
    const { totalOre, applicationFeeOre } = calculateStripeAmounts(table.price_sek)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalOre,
      currency: 'sek',
      capture_method: outcome.captureMethod!,
      application_fee_amount: applicationFeeOre,
      transfer_data: { destination: stripeAccountId },
      metadata: {
        market_table_id: marketTableId,
        flea_market_id: fleaMarketId,
        booked_by: user.id,
        booking_date: bookingDate,
      },
    })
    paymentIntentId = paymentIntent.id
    clientSecret = paymentIntent.client_secret
  }

  // Create booking
  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .insert({
      market_table_id: marketTableId,
      flea_market_id: fleaMarketId,
      booked_by: user.id,
      booking_date: bookingDate,
      status: outcome.status,
      price_sek: priceSek,
      commission_sek: commissionSek,
      commission_rate: commissionRate,
      message: message || null,
      stripe_payment_intent_id: paymentIntentId,
      payment_status: outcome.paymentStatus,
      expires_at: outcome.expiresAt,
    })
    .select('id')
    .single()
  if (bookingErr) throw bookingErr

  // Return clientSecret only when Stripe is involved
  const response: Record<string, unknown> = { bookingId: booking.id }
  if (clientSecret) response.clientSecret = clientSecret
  return response
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/booking-create/index.ts
git commit -m "feat: add booking-create edge function with free/auto-accept branching"
```

---

### Task 6: Update Stripe Webhook for Auto-Accept

**Files:**
- Modify: `supabase/functions/stripe-webhooks/index.ts`

- [ ] **Step 1: Add `payment_intent.succeeded` handler**

In `supabase/functions/stripe-webhooks/index.ts`, add a new case in the switch block (after `payment_intent.payment_failed`):

```typescript
    case 'payment_intent.succeeded': {
      const pi = event.data.object
      // Find the booking
      const { data: booking } = await admin
        .from('bookings')
        .select('id, flea_market_id, status')
        .eq('stripe_payment_intent_id', pi.id)
        .single()
      if (!booking) break

      // Check if market has auto-accept
      const { data: market } = await admin
        .from('flea_markets')
        .select('auto_accept_bookings')
        .eq('id', booking.flea_market_id)
        .single()

      if (market?.auto_accept_bookings) {
        // Auto-accept: confirm immediately
        await admin
          .from('bookings')
          .update({ status: 'confirmed', payment_status: 'captured' })
          .eq('id', booking.id)
      } else {
        // Manual: mark payment as ready for capture
        await admin
          .from('bookings')
          .update({ payment_status: 'requires_capture' })
          .eq('id', booking.id)
      }
      break
    }
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhooks/index.ts
git commit -m "feat: handle payment_intent.succeeded for auto-accept in webhook"
```

---

### Task 7: Update Capture/Cancel for Free Bookings

**Files:**
- Modify: `supabase/functions/stripe-payment-capture/index.ts`
- Modify: `supabase/functions/stripe-payment-cancel/index.ts`

- [ ] **Step 1: Update capture to handle free bookings**

In `supabase/functions/stripe-payment-capture/index.ts`, replace the `if (!booking.stripe_payment_intent_id)` check. After the booking fetch and `verifyOrganizer` call, change:

```typescript
  // Before:
  if (!booking.stripe_payment_intent_id) throw new Error('No payment intent for this booking')
  await stripe.paymentIntents.capture(booking.stripe_payment_intent_id)

  // After:
  if (booking.stripe_payment_intent_id) {
    await stripe.paymentIntents.capture(booking.stripe_payment_intent_id)
  }
```

- [ ] **Step 2: Update cancel to handle free bookings**

In `supabase/functions/stripe-payment-cancel/index.ts`, the existing code at line 27-29 already handles this correctly:

```typescript
  if (booking.stripe_payment_intent_id) {
    await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id)
  }
```

Verify this is the case — no change needed if the guard is already there.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-payment-capture/index.ts
git commit -m "feat: handle free bookings in capture endpoint"
```

---

### Task 8: Update `use-booking` Hook

**Files:**
- Modify: `web/src/hooks/use-booking.ts`

- [ ] **Step 1: Update hook for conditional Stripe flow**

Replace `web/src/hooks/use-booking.ts` with:

```typescript
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { api, MarketTable } from '@/lib/api'
import { calculateCommission, COMMISSION_RATE, isFreePriced, validateBookingDate } from '@fyndstigen/shared'
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
  isFree: boolean
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
  const isFree = isFreePriced(price)
  const commission = isFree ? 0 : calculateCommission(price, COMMISSION_RATE)
  const totalPrice = price + commission

  // Computed: can submit — Stripe not required for free bookings
  const canSubmit = !!selectedTable && !!date && dateValidation.valid && !!userId && !isSubmitting

  const submit = useCallback(async () => {
    if (!canSubmit || !selectedTable) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // 1. Create booking via edge function
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('booking-create', {
        body: {
          marketTableId: selectedTable.id,
          fleaMarketId: marketId,
          bookingDate: date,
          message: message || undefined,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message || 'Failed to create booking')

      // 2. If paid, confirm card payment
      if (res.data.clientSecret) {
        if (!stripe || !elements) throw new Error('Stripe not loaded')
        const cardElement = elements.getElement(CardElement)
        if (!cardElement) throw new Error('Card element not found')

        const { error: confirmError } = await stripe.confirmCardPayment(res.data.clientSecret, {
          payment_method: { card: cardElement },
        })
        if (confirmError) throw new Error(confirmError.message)
      }

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
    isFree,
    canSubmit,
    submit,
    isSubmitting,
    isDone,
    submitError,
    reset,
  }
}
```

Key changes:
- Calls `booking-create` instead of `stripe-payment-create`
- Only runs Stripe confirmation if `clientSecret` is returned
- Exports `isFree` for UI to conditionally render card form
- `canSubmit` no longer requires Stripe to be loaded for free bookings

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/use-booking.ts
git commit -m "feat: update use-booking for conditional Stripe flow"
```

---

### Task 9: Update Create Market UI

**Files:**
- Modify: `web/src/app/profile/create-market/page.tsx`

- [ ] **Step 1: Add auto-accept toggle state**

In `web/src/app/profile/create-market/page.tsx`, add state after the existing market info states (around line 32):

```typescript
const [autoAcceptBookings, setAutoAcceptBookings] = useState(false)
```

- [ ] **Step 2: Compute whether Stripe is needed**

After the `stripeReady` line (line 29), add:

```typescript
const hasAnyPaidTable = tables.some((t) => t.priceSek > 0)
const needsStripe = hasAnyPaidTable
```

- [ ] **Step 3: Update handleSubmit to pass auto_accept**

In the `handleSubmit` function, add `autoAcceptBookings` to the createMarket call. This means `useCreateMarket` also needs updating — but check if it already passes through extra fields. If the hook uses `CreateFleaMarketPayload`, add `autoAcceptBookings` to that type in `packages/shared/src/types.ts`:

In `packages/shared/src/types.ts`, find `CreateFleaMarketPayload` (line 203) and add:

```typescript
export type CreateFleaMarketPayload = {
  name: string
  description: string
  address: AddressPayload
  isPermanent: boolean
  organizerId: string
  autoAcceptBookings: boolean  // <-- add this
  tables: { ... }[]
  // ... rest unchanged
}
```

Then in `handleSubmit`, add `autoAcceptBookings` to the payload:

```typescript
const result = await createMarket({
  name: name.trim(),
  description: description.trim(),
  street: address.street.trim(),
  zipCode: address.zipCode.trim(),
  city: address.city.trim(),
  isPermanent,
  autoAcceptBookings,  // <-- add this
  organizerId: user.id,
  tables,
  images,
  openingHours: rules,
  openingHourExceptions: exceptions,
  coordinates: address.latitude && address.longitude
    ? { latitude: address.latitude, longitude: address.longitude }
    : undefined,
})
```

- [ ] **Step 4: Add toggle to the UI**

Add the auto-accept toggle in the Step 2 section of the form, before the submit button area. Insert before the Stripe warning div (around line 458):

```tsx
{/* Auto-accept toggle */}
<div className="flex items-center justify-between p-4 bg-cream-warm/50 rounded-xl">
  <div>
    <p className="text-sm font-semibold text-espresso">
      Godkänn bokningar automatiskt
    </p>
    <p className="text-xs text-espresso/60 mt-0.5">
      Bokningar bekräftas direkt utan din godkännande
    </p>
  </div>
  <button
    type="button"
    role="switch"
    aria-checked={autoAcceptBookings}
    onClick={() => setAutoAcceptBookings(!autoAcceptBookings)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      autoAcceptBookings ? 'bg-rust' : 'bg-espresso/20'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
        autoAcceptBookings ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
</div>
```

- [ ] **Step 5: Update Stripe gate to be conditional**

Change the Stripe warning (line 461) from:

```tsx
{!stripeLoading && !stripeReady && (
  <div className="bg-mustard/10 border border-mustard/20 rounded-xl px-4 py-3 text-sm text-mustard mb-4">
    <Link href="/profile" className="underline font-semibold">Koppla betalning</Link>
    {' '}i din profil innan du kan publicera.
  </div>
)}
```

To:

```tsx
{!stripeLoading && !stripeReady && needsStripe && (
  <div className="bg-mustard/10 border border-mustard/20 rounded-xl px-4 py-3 text-sm text-mustard mb-4">
    <Link href="/profile" className="underline font-semibold">Koppla betalning</Link>
    {' '}för att ta betalt för bord.
  </div>
)}
```

- [ ] **Step 6: Update submit button disabled condition**

Change line 477 from:

```tsx
disabled={saving || !stripeReady}
```

To:

```tsx
disabled={saving || (needsStripe && !stripeReady)}
```

- [ ] **Step 7: Update price display to show "Gratis"**

Change the table price display (line 325) from:

```tsx
<span className="font-display font-bold text-rust text-sm">
  {t.priceSek} kr
</span>
```

To:

```tsx
<span className="font-display font-bold text-rust text-sm">
  {t.priceSek > 0 ? `${t.priceSek} kr` : 'Gratis'}
</span>
```

- [ ] **Step 8: Commit**

```bash
git add web/src/app/profile/create-market/page.tsx packages/shared/src/types.ts
git commit -m "feat: add auto-accept toggle, free table display, conditional Stripe gate in create market"
```

---

### Task 10: Update `useCreateMarket` Hook

**Files:**
- Grep for: `web/src/hooks/use-create-market.ts` (or wherever the hook lives)

- [ ] **Step 1: Find and update the hook**

The hook needs to pass `auto_accept_bookings` when inserting the flea market row. Find where the `flea_markets` insert happens and add:

```typescript
auto_accept_bookings: payload.autoAcceptBookings ?? false,
```

to the insert object.

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/use-create-market.ts
git commit -m "feat: pass auto_accept_bookings in create market hook"
```

---

### Task 11: Verify & Deploy

- [ ] **Step 1: Run all shared package tests**

Run: `cd packages/shared && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run all web tests**

Run: `cd web && npx vitest run`
Expected: All pass (some booking tests may need updating if they mock stripe-payment-create — rename to booking-create)

- [ ] **Step 3: Fix any failing tests**

Update test mocks that reference `stripe-payment-create` to use `booking-create`.

- [ ] **Step 4: Deploy edge functions**

Deploy the new and modified edge functions:

```bash
npx supabase functions deploy booking-create
npx supabase functions deploy stripe-webhooks
npx supabase functions deploy stripe-payment-capture
npx supabase functions deploy stripe-payment-cancel
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: fix tests for booking-create rename"
```
