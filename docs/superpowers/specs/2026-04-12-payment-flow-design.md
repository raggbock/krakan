# Payment Flow — Table Booking

## Overview

Add Stripe-based payment to the existing table booking system. Visitors pay when booking, organizers receive payment when they approve. Platform takes 12% commission via Stripe application fees.

**Key decisions:**
- Stripe Connect (Standard) for organizer payouts
- Manual capture (auth/hold) at booking, capture on approval
- 7-day auto-cancel for unanswered bookings
- Supabase Edge Functions as API layer (platform-agnostic — web + mobile)

## Stripe Connect Onboarding

### Data model

New table `stripe_accounts`:

| Column | Type | Description |
|---|---|---|
| `id` | uuid, PK | |
| `organizer_id` | uuid, FK → profiles | Unique |
| `stripe_account_id` | text | Stripe's `acct_xxx` identifier |
| `onboarding_complete` | boolean, default false | Set true via webhook |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

RLS: organizers can read their own row. Insert/update via edge functions only (service role).

### Flow

1. Organizer clicks "Koppla betalning" in profile
2. Edge function `stripe/connect/create` creates a Stripe Connect Standard account and returns an Account Link URL
3. Organizer completes Stripe's hosted onboarding wizard
4. Stripe sends `account.updated` webhook → edge function verifies `charges_enabled` and `details_submitted` → sets `onboarding_complete = true`
5. Publishing a market with bookable tables requires `onboarding_complete = true`

### Refresh handling

If the organizer drops off mid-onboarding, the profile UI shows "Slutför koppling" which generates a fresh Account Link for the existing `stripe_account_id`.

## Payment Flow

### Data model changes

Extend `bookings` table:

| Column | Type | Description |
|---|---|---|
| `stripe_payment_intent_id` | text, nullable | Stripe's `pi_xxx` |
| `payment_status` | text, nullable | `requires_capture`, `captured`, `cancelled`, `failed` |
| `expires_at` | timestamptz, nullable | Booking + 7 days |

### Booking (visitor side)

1. Visitor selects table + date (existing UI)
2. Stripe Elements card form rendered in `BookableTablesCard`
3. Frontend calls edge function `stripe/payment-intent/create`:
   - Creates PaymentIntent with:
     - `amount`: price_sek + commission_sek (in öre)
     - `currency`: `sek`
     - `capture_method`: `manual`
     - `application_fee_amount`: commission_sek (in öre)
     - `transfer_data.destination`: organizer's `stripe_account_id`
   - Returns `client_secret`
4. Frontend confirms PaymentIntent via `stripe.confirmCardPayment(clientSecret)`
5. On success → edge function creates booking in DB:
   - `status`: `pending`
   - `payment_status`: `requires_capture`
   - `expires_at`: `now() + interval '7 days'`
   - `stripe_payment_intent_id`: from Stripe response

### Approval (organizer side)

1. Organizer clicks "Godkänn" (existing UI)
2. Edge function `stripe/payment-intent/capture`:
   - Calls `stripe.paymentIntents.capture(pi_xxx)`
   - On success → `status: confirmed`, `payment_status: captured`
   - On failure (hold expired, insufficient funds) → error message to organizer

### Denial (organizer side)

1. Organizer clicks "Neka"
2. Edge function `stripe/payment-intent/cancel`:
   - Calls `stripe.paymentIntents.cancel(pi_xxx)`
   - `status: denied`, `payment_status: cancelled`

### Cancellation by visitor

1. Visitor cancels their own pending booking
2. Same cancel flow as denial — PaymentIntent cancelled, hold released

## Auto-Cancel (expired holds)

- **Trigger**: Supabase pg_cron, runs daily
- **Logic**: Find bookings where `status = 'pending'` AND `expires_at < now()`
- **Action**: Cancel PaymentIntent in Stripe via edge function, set `status: cancelled`, `payment_status: cancelled`
- **Note**: No email notifications in this iteration — will be added later

## Edge Functions

All Stripe operations go through Supabase Edge Functions so both web and mobile apps use the same API.

| Function | Method | Auth | Description |
|---|---|---|---|
| `stripe/connect/create` | POST | Organizer | Create Connect account + Account Link |
| `stripe/connect/status` | GET | Organizer | Check onboarding status |
| `stripe/connect/refresh` | POST | Organizer | Generate fresh Account Link |
| `stripe/payment-intent/create` | POST | Authenticated user | Create PaymentIntent with manual capture |
| `stripe/payment-intent/capture` | POST | Organizer (owns market) | Capture held payment |
| `stripe/payment-intent/cancel` | POST | Organizer or booker | Cancel/release hold |
| `stripe/webhooks` | POST | Stripe signature | Handle Stripe webhook events |

### Webhook events to handle

| Event | Action |
|---|---|
| `account.updated` | Update `stripe_accounts.onboarding_complete` |
| `payment_intent.canceled` | Sync `payment_status` if cancelled externally |
| `payment_intent.payment_failed` | Set `payment_status: failed` |

## Frontend Changes

### BookableTablesCard

- Add Stripe Elements `CardElement` below date picker
- Wrap in `Elements` provider with publishable key
- "Skicka förfrågan" → "Boka & reservera belopp" (or similar)
- Show total: pris + serviceavgift (12%)
- Loading/error states for payment processing

### Profile — Stripe Connect

- New section in organizer profile: "Betalning"
- States: not connected → onboarding → connected
- "Koppla betalning" button / "Slutför koppling" / green checkmark

### Profile — Bokningar (organizer)

- "Godkänn" triggers capture instead of just status update
- Show payment status badge on booking cards
- Error handling if capture fails

### Publish gate

- Disable "Publicera" if `onboarding_complete = false`
- Show message: "Koppla betalning innan du kan publicera"

## Dependencies

- `stripe` npm package in `packages/shared` (server-side, edge functions)
- `@stripe/stripe-js` + `@stripe/react-stripe-js` in `web` (frontend Elements)
- Stripe account with Connect enabled
- Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

## Out of scope

- Email/SMS notifications (separate feature)
- Refunds after capture (future iteration)
- Subscription tiers / premium features
- Multiple payment methods (Swish, Klarna) — can be added to Stripe later
- Payout scheduling / custom payout intervals
