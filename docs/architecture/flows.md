# Key user flows

Each flow is a step-by-step trace through actual files. Line references point to the most important entry in each step; search the file for surrounding context.

---

## Anonymous browse + search

1. User hits `/` (`web/src/app/page.tsx`) — Server Component, JSON-LD structured data. No auth required.
2. User navigates to `/loppisar` or the search page. `/search/page.tsx` reads the `q` param server-side via `searchParams`.
3. On the client, `useSearch` (`web/src/hooks/use-search.ts`) calls `deps.search.query(q)` via React Query. `deps.search` resolves to `createSupabaseSearch(supabase)` (`packages/shared/src/adapters/supabase/flea-markets.ts`), which calls the `search_flea_markets` Postgres function.
4. `/map` (`web/src/app/map/page.tsx`) renders `FyndstigenMap` (`web/src/components/fyndstigen-map.tsx`). That calls `deps.markets.nearBy({...})` → PostGIS `ST_DWithin`.
5. Clicking a pin opens `/loppis/[slug]` (`web/src/app/loppis/[slug]/page.tsx`). This Server Component calls `createSupabaseServerData(supabase).getMarketIdBySlug(slug)`, then renders `<MarketDetail id={id} />` (`web/src/components/market/detail.tsx`).
6. If the slug is stale (market renamed), the page checks `flea_market_slug_history` and issues `permanentRedirect` (HTTP 308) to the current slug.

---

## Authentication

1. Auth state lives in `AuthContext` (`web/src/lib/auth/auth-context.tsx`). `AuthProvider` wraps the app in `web/src/app/layout.tsx`. It calls `auth.getSession()` on mount and subscribes to `auth.onAuthStateChange()`.
2. `auth` is an `AuthWithRedirect` instance (`web/src/lib/auth/auth-with-redirect.ts`). The factory wraps `createSupabaseAuth(supabase)` (`packages/shared/src/adapters/supabase/auth.ts`) and injects `redirectTo` from `window.location.origin`. Callers never supply the redirect URL — it's derived at call time.
3. **Email/password sign-up**: `auth.signUp(email, password)` → confirmation email → user clicks link → `/auth` callback.
4. **Google OAuth**: `auth.signInWithGoogle()` → Supabase OAuth redirect → callback lands on `/auth/callback`.
5. **Password reset**: `auth.resetPasswordForEmail(email)` → magic-link → `/auth/reset-password` with OTP in URL hash.
6. Auth-required pages encode the original destination in `?next=` and redirect unauthenticated users to `/auth`.

---

## Market creation (organizer)

1. Authenticated user at `/profil/skapa` fills out `MarketForm` (`web/src/components/market-form/`). The form produces a `MarketPlan` object.
2. `useSubmitMarket` calls `runMarketMutation(plan, deps)` (`packages/shared/src/domain/market-mutation.ts`) — the async-generator saga.
3. If the market has paid tables, the organizer must connect a Stripe account. `useStripeConnect` (`web/src/hooks/use-stripe-connect.ts`) calls the `stripe-connect-create` edge function, which creates a Stripe Connect Standard account and returns an `accountLinkUrl` for Stripe's hosted onboarding.
4. On return from Stripe, `stripe-connect-refresh` or `stripe-connect-status` edge functions check `account.charges_enabled` and update `stripe_accounts.onboarding_complete`.
5. `runMarketMutation` saga phases: **geocode** address (Nominatim) → **upsert** `flea_markets` row → **upsert** `market_tables` rows → **upsert** `opening_hour_rules` rows → **upload** images to Supabase Storage. Each phase emits start/ok/failed events consumed by the hook.
6. On `{ type: 'complete' }` the organizer is navigated to `/loppis/[slug]`.

---

## Booking flow — free path

A free booking is one where `isFreePriced(price)` is true (`packages/shared/src/domain/booking.ts`).

1. User on `/loppis/[slug]` selects a table from `BookableTablesCard` (`web/src/components/booking/tables-card.tsx`).
2. `useBooking(marketId, ...)` (`web/src/hooks/use-booking.ts`) manages state. After table selection, `deps.bookings.availableDates(tableId)` fetches already-booked dates. `bookingService.validateDate()` runs the domain validator from `domain/booking.ts` against those dates.
3. User submits. `bookingService.book({...}, { payment })` is called. The async-generator:
   a. Yields `{ type: 'submitted' }`.
   b. Calls `api.endpoints['booking-create'].invoke(...)` → the `booking-create` edge function.
4. In `supabase/functions/booking-create/index.ts`: `decideCreateBooking({ priceSek: 0, autoAccept })` returns `{ needsStripe: false, status: 'confirmed' }`. No PaymentIntent is created.
5. A `bookings` row is inserted with `status: 'confirmed'`.
6. Edge function returns `{ bookingId }` (no `clientSecret`).
7. Generator yields `{ type: 'created', requiresPayment: false }` then `{ type: 'succeeded' }`. Hook sets `isDone = true`.

---

## Booking flow — paid path

For `price_sek > 0` and organizer with completed Stripe Connect onboarding:

1. Steps 1–3 same as free path. `resolvePaymentGateway({ stripe, elements })` (`web/src/lib/stripe/gateway-factory.ts`) returns a real Stripe.js gateway.
2. `decideCreateBooking` returns `{ needsStripe: true, captureMethod: 'manual', status: 'pending', expiresAt: <now+24h> }`. The edge function fetches the organizer's `stripe_account_id` and calls `createStripeBookingGateway(stripe).createPaymentIntentWithFees({...})` (`packages/shared/src/adapters/stripe/booking-stripe-gateway.ts`).
3. Stripe creates a PaymentIntent with `capture_method: 'manual'` and `application_fee_amount` (12% of total in øre). Returns a `clientSecret`.
4. Edge function inserts the booking with `status: 'pending'` and returns `{ bookingId, clientSecret }`.
5. Generator yields `{ type: 'payment-required', clientSecret }`. The payment gateway calls `stripe.confirmCardPayment(clientSecret)`.
6. On success, generator yields `{ type: 'payment-confirmed' }` then `{ type: 'succeeded' }`.
7. Stripe fires `payment_intent.succeeded` webhook → `stripe-webhooks` edge function (see §Stripe webhook). For auto-accept markets the booking is immediately set to `status: 'confirmed'`; for manual-accept it stays `pending`.
8. Organizer approval calls `stripe-payment-capture` edge function → `stripe.paymentIntents.capture(paymentIntentId)`. `applyBookingEvent(booking, { type: 'organizer.approve' })` computes the DB patch.

---

## Stripe webhook processing

`supabase/functions/stripe-webhooks/index.ts`:

1. Reads `stripe-signature` header. Calls `stripe.webhooks.constructEventAsync(body, sig, webhookSecret)`. Returns 400 on signature failure.
2. Calls `prefetchLookups(event, repos)` (`lookups.ts`) — loads any DB rows the reducer needs (e.g. the booking that owns a given PaymentIntent).
3. Calls `interpretWebhookEvent({ event, lookups, now })` from `packages/shared/src/stripe-webhook.ts`. **Pure function** — no I/O. Returns `WebhookCommand[]`.
4. Iterates commands, calling `executeCommand(cmd, repos)` (`execute.ts`) for each. Commands: `booking.markPaid`, `booking.markCanceled`, `account.setOnboarding`, `subscription.setTier`, `log.warn`, `noop`.
5. On DB error, logs and returns HTTP 500 for Stripe to retry.

The reducer is unit-tested in `packages/shared/src/stripe-webhook.test.ts` without any network or Deno dependency.

---

## Route building

1. User at `/rundor/skapa`. Page renders `RouteBuilder` (`web/src/components/route-builder/`), which calls `useRouteBuilder()` (`web/src/hooks/use-route-builder.ts`).
2. Hook resolves dependencies (`useDeps()`, GPS via `navigator.geolocation`, `localStorage`) and calls `useMarketsQuery(geo)` to load nearby markets.
3. `useDraftPersistence(...)` (`web/src/hooks/route-builder/use-draft-persistence.ts`) autosaves the current stop list to `localStorage` on every change. On mount, it restores the draft.
4. User toggles stops; optionally clicks "Optimize" → `deps.geo.optimizeStops()` → nearest-neighbor algorithm in `packages/shared/src/domain/route-optimizer.ts`.
5. **Authenticated save**: `useRouteSave` calls `runRouteMutation(plan, deps.routes)` (`packages/shared/src/domain/route-mutation.ts`). Phases: `saving_route`, `saving_stops`. On `{ type: 'complete' }`, navigates to `/rundor/[slug]`.
6. **Anonymous save**: `saveAnon(email)` calls the `route-create-anon` edge function (`supabase/functions/route-create-anon/index.ts`) — a `definePublicEndpoint`. Applies rate limit (5 saves/email/24 h), resolves or creates a user account, saves the route, sends a magic-link email via Resend so the user can access it later.
7. After save, `clearDraft()` wipes the `localStorage` draft.

---

## Takeover — organizer claim

1. **Admin sends invite**: at `/admin/takeover`. `admin-takeover-send` edge function generates a signed token (`packages/shared/src/crypto.ts`), inserts it into `takeover_tokens`, sends an email with a link to `/takeover/[token]`.
2. **Recipient lands on takeover page**: `takeover-info` edge function validates the token and returns the market name.
3. **Recipient submits email**: `takeover-start` edge function (`supabase/functions/takeover-start/index.ts`) validates the token, checks that the submitted email matches `sent_to_email`, then calls `claimTakeover` from `_shared/claim-takeover.ts`.
4. **`claimTakeover`**: calls the `claim_takeover_atomic` Postgres RPC (spends the token, transfers `flea_markets.organizer_id` in one transaction). Resolves or creates an auth user. Sends a magic-link email to the new owner.
5. **Recipient clicks magic link**: standard Supabase magic-link flow. User lands on their market page as the authenticated organizer.

---

## Kvartersloppis (block sale)

1. **Create event**: Organizer at `/skapa/kvartersloppis` submits a form. `block-sale-create` edge function (`supabase/functions/block-sale-create/index.ts`) validates via `validateBlockSaleInput` (`packages/shared/src/domain/block-sale.ts`), geocodes the address, generates a slug, inserts a `block_sales` row.
2. **Apply for a stand**: Visitor on `/kvartersloppis/[slug]` submits an application. `block-sale-stand-apply` inserts a `block_sale_stands` row with `status: 'pending'` and sends a confirmation email.
3. **Email confirmation**: Applicant clicks the link → `block-sale-stand-confirm` transitions `status: 'pending' → 'confirmed'`.
4. **Organizer decides**: `block-sale-decide` edge function applies `canTransitionStandStatus(from, to)` from `domain/block-sale.ts` (`confirmed → approved | rejected`). Approved stands receive an email.
5. **Public map**: `/kvartersloppis/[slug]` renders a map of all `status: 'approved'` stands.

---

## Admin

All admin routes are under `web/src/app/admin/`. Access is gated by `useAdmin` (`web/src/hooks/use-admin.ts`), which checks `user.email` against `NEXT_PUBLIC_ADMIN_EMAILS`.

1. **Markets overview**: `useAdminMarketsOverview` calls the `admin-markets-overview` edge function → returns all markets with metadata. `useMarketCuration` (`web/src/hooks/use-market-curation.ts`) applies client-side filter/sort using `marketCompleteness` from `domain/market-completeness.ts`.
2. **Inline edit**: `EditMarketDrawer` (`web/src/app/admin/markets/edit-market-drawer.tsx`) calls `admin-market-edit`.
3. **Bulk geocode**: `runGeocodeSession` (`web/src/app/admin/markets/geocode-session.ts`) batch-geocodes markets with missing coordinates using Nominatim.
4. **Business import**: admin uploads JSON. `admin-business-import` validates rows with `domain/business-import.ts`, diffs against existing records, upserts changed fields only.
5. **Takeover funnel** (`/admin/takeover-funnel`): `useAdminTakeoverFunnel` calls `admin-takeover-funnel` for pipeline state.
