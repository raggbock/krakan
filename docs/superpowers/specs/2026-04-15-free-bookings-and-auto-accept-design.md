# Free Bookings, Auto-Accept & Optional Stripe

**Date:** 2026-04-15
**Status:** Draft

## Problem

Today, all bookings require Stripe Connect onboarding and payment. This creates unnecessary friction for organizers who want free tables or don't need payment processing. Additionally, organizers must manually approve every booking, even when they'd prefer automatic confirmation.

## Goals

1. Allow organizers to offer free tables (price = 0) without Stripe
2. Allow organizers to enable auto-accept so bookings are confirmed instantly
3. Only require Stripe when at least one table has a price > 0

## Design

### Database Changes

**`flea_markets` — new column:**

```sql
alter table public.flea_markets
  add column auto_accept_bookings boolean not null default false;
```

**`market_tables` — allow price 0:**

`price_sek` already allows 0 (integer not null, no check > 0). Change default:

```sql
alter table public.market_tables
  alter column price_sek set default 0;
```

**`bookings` — new payment_status value:**

`payment_status` gains a `'free'` value. Existing values: `requires_capture`, `captured`, `cancelled`. The column was added in migration 00002 as `text` with no check constraint, so no schema change needed — just use `'free'` in application code.

`expires_at` is set to null for free bookings (nothing to expire).

### Edge Function: `booking-create` (replaces `stripe-payment-create`)

Single endpoint with branching logic:

| price_sek | auto_accept | Stripe needed | PaymentIntent | Initial status | payment_status |
|-----------|-------------|---------------|---------------|----------------|----------------|
| 0 | true | No | None | `confirmed` | `free` |
| 0 | false | No | None | `pending` | `free` |
| > 0 | true | Yes | `automatic` capture | `pending`* | `requires_payment` |
| > 0 | false | Yes | `manual` capture | `pending` | `requires_capture` |

*For paid + auto-accept: booking starts `pending` until payment succeeds. The `payment_intent.succeeded` webhook sets it to `confirmed`. The organizer doesn't need to act, but money must land first.

**Validation changes:**
- Stripe account check only when `price_sek > 0`
- Idempotency check remains the same
- Date validation remains the same

**Return value:**
- Always: `{ bookingId }`
- When paid: also `{ clientSecret }` for Stripe Elements

### Stripe Webhook Updates

`stripe-webhooks` must handle `payment_intent.succeeded` for auto-accept bookings:
- Look up booking via `stripe_payment_intent_id` from the event
- Look up market via `flea_market_id` on the booking to check `auto_accept_bookings`
- If `auto_accept_bookings = true` → set booking status to `confirmed`, payment_status to `captured`
- If `auto_accept_bookings = false` → keep status `pending`, set payment_status to `requires_capture` (existing behavior, organizer still needs to approve and capture)

### Existing Edge Functions

**`stripe-payment-capture`:** Add early return for free bookings (no payment intent to capture). Update status from `pending` → `confirmed`.

**`stripe-payment-cancel`:** Add early return for free bookings (no payment intent to cancel). Update status from `pending` → `denied` or `cancelled`.

### Client: `use-booking` Hook

- `submit()` always calls `booking-create`
- If response has `clientSecret` → show card form, confirm payment (existing flow)
- If no `clientSecret` → booking is done, show confirmation
- `totalPrice` and `commission` return 0 for free tables
- UI shows "Gratis" instead of price when `price_sek === 0`
- Stripe Elements (`<CardElement>`) only rendered when `price_sek > 0`

### Organizer UI

**Create/edit market:**
- New toggle: "Godkänn bokningar automatiskt" (default off)
- Table price field allows 0, displayed as "Gratis"

**Stripe onboarding:**
- No longer required at publish time if all tables are free
- If organizer sets price > 0 without Stripe → show message: "Koppla Stripe för att ta betalt"
- Existing onboarding flow preserved, now opt-in rather than blocking

**Booking management (organizer view):**
- Free + auto-accept: booking appears as `confirmed`, nothing to do
- Free + manual: same approve/deny buttons, but no capture call
- Paid: unchanged

### Shared Package

`packages/shared/src/booking.ts`:
- `calculateStripeAmounts(0)` already returns 0s — no change needed
- Status transitions: no change needed (`pending → confirmed` already valid)

`supabase/functions/_shared/pricing.ts`:
- Same — mirrors shared package, handles 0 correctly

## Out of Scope

- Email/push notifications for new bookings
- Batch auto-accept settings across multiple markets
- Partial payment / deposit model
