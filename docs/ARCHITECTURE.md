# Fyndstigen — Architecture

Audience: new contributors and future maintainers. This document describes how the three packages relate to each other, the patterns they share, and where to find things.

Detailed flow traces live in [docs/architecture/flows.md](architecture/flows.md).

---

## 1. Overview

**Fyndstigen** (fyndstigen.se) is a Swedish flea-market platform. Visitors discover markets on a map, browse listings, book seller tables, and plan multi-stop routes. Organizers manage their markets, handle bookings, and set up Stripe payments. Admins curate the market catalogue and run the organizer onboarding funnel.

A secondary feature — **kvartersloppis** (block sale) — lets an organizer create a pop-up street market, collect stand applications, confirm participants by email, and publish a public map with all confirmed stands.

### Three packages, one shared language

```
packages/shared/    @fyndstigen/shared — canonical domain logic, types, ports & adapters
web/                Next.js 15 — the primary product, deployed to Cloudflare Workers
supabase/functions/ Supabase Edge Functions (Deno + TypeScript) — payments, mutations
supabase/migrations PostgreSQL migrations (PostGIS enabled)
scripts/            Seed-data scrapers and bulk-import utilities
app/                React Native client (legacy; NOT built by CI)
mobile/             Expo client (newer; NOT built by CI)
```

The web app is the primary product. Both mobile clients import `@fyndstigen/shared` but are not built or deployed automatically — check with the maintainer before modifying them.

### Deployment targets

| Layer | Runtime | Target |
|---|---|---|
| `web/` | Next.js 15 + React Query | Cloudflare Workers via OpenNext |
| `supabase/functions/` | Deno | Supabase Edge Functions |
| Database | PostgreSQL + PostGIS | Supabase (managed) |

---

## 2. Architectural patterns

### 2.1 Ports & adapters

All external I/O is hidden behind **port interfaces** in `packages/shared/src/ports/`. Domain code only depends on port types — never on Supabase or Stripe directly. Implementations live in `packages/shared/src/adapters/`:

```
ports/
  flea-markets.ts       FleaMarketRepository, MarketTableRepository, SearchRepository
  bookings.ts           BookingRepository
  routes.ts             RouteRepository
  profiles.ts           ProfileRepository, OrganizerRepository
  admin.ts              AdminPort
  stats.ts              StatsPort
  images.ts             ImagePort
  payment.ts            PaymentGateway
  booking-repo.ts       BookingRepo (narrow interface for edge fns)
  stripe-account-repo.ts
  subscription-repo.ts
  logger.ts

adapters/
  supabase/             Production implementations — one file per port
  in-memory/            Test doubles — synchronous, no network
  stripe/               booking-stripe-gateway.ts (PaymentGateway adapter)
```

`ports/flea-markets.ts` declares `FleaMarketRepository`. The web app receives `adapters/supabase/flea-markets.ts`; unit tests receive `adapters/in-memory/flea-markets.ts`. The market-mutation saga (`domain/market-mutation.ts`) never imports either — it calls the interface.

### 2.2 Dependency container

`packages/shared/src/deps.ts` defines the `Deps` aggregate type that bundles all port instances:

```typescript
// packages/shared/src/deps.ts
export type Deps = {
  markets: FleaMarketRepository
  marketTables: MarketTableRepository
  routes: RouteRepository
  profiles: ProfileRepository
  organizers: OrganizerRepository
  admin: AdminPort
  bookings: BookingRepository
  stats: StatsPort
  search: SearchRepository
  images: ImagePort
}
```

`packages/shared/src/deps-factory.ts` exports:
- `makeSupabaseDeps(supabaseClient)` — production, called once at app bootstrap
- `makeInMemoryDeps(seed?)` — unit tests, accepts optional seed data
- `createE2EInMemoryDeps()` — E2E tests, includes a `control` handle for seeding

Wiring happens in `web/src/providers/query-provider.tsx`:

```typescript
const appDeps = buildAppDeps()  // constructed ONCE at module scope

export function QueryProvider({ children }) {
  return (
    <DepsProvider deps={appDeps}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DepsProvider>
  )
}
```

`DepsProvider` (`web/src/providers/deps-provider.tsx`) publishes `Deps` via React context. Hooks call `useDeps()`. When `NEXT_PUBLIC_E2E_FAKE=1`, `createE2EInMemoryDeps()` is used instead and a `window.__e2eBridge__` handle is exposed so Playwright can seed data without touching the real database.

### 2.3 Edge function middleware

Every edge function goes through one of two wrappers:

**`defineEndpoint`** (`supabase/functions/_shared/endpoint.ts`) — JWT-authenticated routes:
1. CORS preflight handling.
2. Verify Supabase JWT from `Authorization` header.
3. Parse request body against a Zod input schema; return HTTP 400 with `{ error: 'input.invalid', detail: { issues } }` on failure.
4. Call the typed handler.
5. Validate the return value against a Zod output schema (throws in `SUPABASE_ENVIRONMENT=development`; warns in production to avoid outages on schema drift).

**`definePublicEndpoint`** (`supabase/functions/_shared/public-endpoint.ts`) — for routes that authenticate via their own mechanism (token in body, webhook signature, etc.). Same pipeline, no JWT check, service-role client provided.

**`createHandler`** (`supabase/functions/_shared/handler.ts`) — the lower-level primitive used directly by a few older functions.

```typescript
// supabase/functions/booking-create/index.ts
defineEndpoint({
  name: 'booking-create',
  input: BookingCreateInput,    // Zod schema from packages/shared/src/contracts/
  output: BookingCreateOutput,
  handler: async ({ user, admin }, { marketTableId, fleaMarketId, bookingDate }) => {
    // user is verified; input is typed and validated
  },
})
```

### 2.4 Contracts — shared I/O language

`packages/shared/src/contracts/` holds Zod schemas shared between the web app and edge functions. One file per edge function. The edge functions import the schemas directly via the Deno import map:

```json
// supabase/functions/deno.json (excerpt)
{ "@fyndstigen/shared/": "../../packages/shared/src/" }
```

So `import { BookingCreateInput } from '@fyndstigen/shared/contracts/booking-create.ts'` works unchanged in Deno.

On the web side, `packages/shared/src/api/endpoints.ts` assembles a typed registry (`ENDPOINTS`) mapping each function name to its input/output types. Hooks call `endpoints[key].invoke(body)` for static types. The raw escape hatch for functions not yet in the registry is `invokeEdgeFn<T>()` in `web/src/lib/edge/invoke.ts`.

### 2.5 Event-stream sagas

Several mutation flows are implemented as async-generator functions that emit typed events. This eliminates closure-reference bugs, provides structured progress to the UI, and treats failure as data rather than an exception.

**`runMarketMutation`** (`packages/shared/src/domain/market-mutation.ts`) — save a flea market. Phases: `geocoding`, `saving_market`, `saving_tables`, `saving_rules`, `saving_images`. Web hook iterates the stream and updates React state per event.

**`runRouteMutation`** (`packages/shared/src/domain/route-mutation.ts`) — save a loppisrunda. Phases: `saving_route`, `saving_stops`. Per-item events allow fine-grained progress for each stop add/remove.

**`BookingService.book()`** (`packages/shared/src/domain/booking-service.ts`) — full client-side booking orchestration as `AsyncIterable<BookingProgress>`. Events: `submitted → created → [payment-required → payment-confirmed] → succeeded | failed`. `useBooking` (`web/src/hooks/use-booking.ts`) consumes the stream and fires PostHog telemetry per stage.

**`interpretWebhookEvent` + executor** (`packages/shared/src/stripe-webhook.ts`, `supabase/functions/stripe-webhooks/execute.ts`) — pure reducer pattern for Stripe webhooks. The reducer takes a `Stripe.Event` and pre-fetched DB lookups, returns `WebhookCommand[]` with zero I/O. The executor iterates commands. The reducer is tested in `packages/shared/src/stripe-webhook.test.ts` without any network or Deno dependency.

**`applyBookingEvent`** (`packages/shared/src/domain/booking-lifecycle.ts`) — pure `(Booking, BookingEvent) → BookingPatch` reducer. Used by edge functions and in-memory adapters to compute the exact DB patch for any lifecycle transition.

### 2.6 Layered structure of `packages/shared/src/`

```
domain/       Commands: booking.ts, booking-lifecycle.ts, booking-service.ts,
              market-mutation.ts, route-mutation.ts, block-sale.ts,
              business-import.ts, market-completeness.ts, opening-hours.ts,
              route-optimizer.ts
query/        Reads: flea-market.ts, booking.ts, route.ts (select strings + mappers)
contracts/    Zod schemas, one per edge function I/O pair
ports/        TypeScript interfaces for all I/O (no implementations)
adapters/
  supabase/   Production DB implementations
  in-memory/  Test doubles
  stripe/     booking-stripe-gateway.ts (PaymentIntent creation)
errors/       AppError, ErrorCode union, messageFor() (Swedish UI strings)
types/        domain.ts (View types), db.ts (row types), shared-enums.ts, index.ts
geo/          GeoService + Nominatim implementation, GeocodeError
format.ts     Pure string utilities (slugifyCity, etc.)
crypto.ts     sha256Hex, generateCode, timingSafeEqualHex
stripe-webhook.ts   Pure webhook reducer
api/          Legacy createApi(), endpoint invokers, mappers (being superseded by Deps)
deps.ts       Deps aggregate type
deps-factory.ts     makeSupabaseDeps / makeInMemoryDeps / createE2EInMemoryDeps
index.ts      Public re-export surface for @fyndstigen/shared
```

---

## 3. Key user flows

See [docs/architecture/flows.md](architecture/flows.md) for step-by-step file-traced walkthroughs of:

- Anonymous browse + search
- Authentication (email/password, Google OAuth, magic-link)
- Market creation (organizer) with Stripe Connect onboarding
- Booking flow (free path)
- Booking flow (paid path — Stripe Connect manual capture)
- Stripe webhook processing
- Route building (authenticated + anonymous save via magic link)
- Takeover — organizer claim
- Kvartersloppis (block sale) — apply → confirm → decide → public map
- Admin — markets overview, takeover funnel, business import, bulk geocode

---

## 4. Module map

### `packages/shared/src/`

| Path | Description |
|---|---|
| `domain/booking.ts` | Commission math, `decideCreateBooking`, `validateBookingDate`, `isFreePriced` |
| `domain/booking-lifecycle.ts` | Pure `(Booking, BookingEvent) → BookingPatch` reducer |
| `domain/booking-service.ts` | `BookingService` facade; `BookingProgress` event stream |
| `domain/market-mutation.ts` | `runMarketMutation` async-generator saga |
| `domain/route-mutation.ts` | `runRouteMutation` async-generator saga |
| `domain/route-optimizer.ts` | Nearest-neighbor stop reordering |
| `domain/block-sale.ts` | Block-sale validation, slug generation, status transitions |
| `domain/business-import.ts` | Import row validation and diff logic |
| `domain/market-completeness.ts` | Scoring function for admin curation |
| `domain/opening-hours.ts` | `checkOpeningHours(rules, exceptions, date)` |
| `query/booking.ts` | Select string, row type, mapper for booking queries |
| `query/flea-market.ts` | Same for markets |
| `query/route.ts` | Same for routes |
| `contracts/` | Zod schemas for every edge function I/O pair |
| `ports/` | TypeScript interfaces for all I/O ports |
| `adapters/supabase/` | Production DB implementations |
| `adapters/in-memory/` | Test doubles |
| `adapters/stripe/booking-stripe-gateway.ts` | Stripe PaymentIntent creation |
| `errors/index.ts` | `AppError`, `ErrorCode` union, `messageFor()` |
| `types/domain.ts` | Canonical domain view types |
| `types/db.ts` | DB row types (for adapters and mappers only) |
| `types/index.ts` | Public surface + back-compat aliases |
| `geo/index.ts` | `GeoService` + Nominatim implementation |
| `format.ts` | Pure string utilities |
| `crypto.ts` | `sha256Hex`, `generateCode`, `timingSafeEqualHex` |
| `stripe-webhook.ts` | `interpretWebhookEvent` pure reducer |
| `deps.ts` | `Deps` aggregate type |
| `deps-factory.ts` | Factory functions for Deps construction |
| `api/` | Legacy surface (being superseded by Deps; still used by booking-service) |

### `web/src/`

#### `app/` (route tree)

| Route | Description |
|---|---|
| `page.tsx` | Landing page — JSON-LD, CTA links |
| `layout.tsx` | Root layout — fonts, `AuthProvider`, `QueryProvider`, Nav |
| `loppisar/` | Browse/search listings |
| `loppis/[slug]/` | Market detail (Server Component + `MarketDetail` client) |
| `map/` | Full-screen map view |
| `search/` | Search results |
| `rundor/` | Route listing and detail |
| `skapa/` | Market creation; `/skapa/kvartersloppis` |
| `kvartersloppis/[slug]/` | Block-sale event detail and stand map |
| `profile/` | User profile, bookings, organizer dashboard |
| `auth/` | Sign-in, sign-up, callback, reset-password |
| `arrangorer/` | Public organizer profile pages |
| `admin/` | Admin-only tools (markets, takeover, import, invite) |
| `takeover/` | Organizer claim flow |

#### `components/`

| Path | Description |
|---|---|
| `market/` | `MarketDetail`, market card, market list |
| `market-form/` | Market creation/edit form, image upload, opening-hours editor |
| `booking/` | `BookableTablesCard`, booking form, booking list |
| `block-sale/` | Block-sale application form and stand map |
| `route-builder/` | Route builder UI |
| `route-view/` | Saved route display |
| `fyndstigen-map.tsx` | Shared map component (Leaflet) |
| `nav.tsx` | Top navigation |

#### `hooks/`

| File | Description |
|---|---|
| `use-booking.ts` | Booking state machine; consumes `BookingProgress` event stream |
| `use-route-builder.ts` | Route builder state; composes sub-hooks |
| `route-builder/use-draft-persistence.ts` | `localStorage` draft autosave |
| `route-builder/use-route-save.ts` | Calls `runRouteMutation` |
| `use-market-curation.ts` | Client-side filter/sort for admin markets |
| `use-market-detail-view-model.ts` | Derived state for market detail page |
| `use-stripe-connect.ts` | Stripe Connect onboarding state |
| `use-takeover.ts` | Takeover claim flow state |
| `use-block-sale.ts` | Block-sale event state |
| `use-admin.ts`, `use-admin-markets.ts` | Admin data access |

#### `lib/`

| Path | Description |
|---|---|
| `auth/auth-context.tsx` | `AuthProvider` + `useAuth()` |
| `auth/auth-with-redirect.ts` | `AuthWithRedirect` factory (injects `redirectTo`) |
| `auth/auth.ts` | App-level `auth` singleton (browser) |
| `edge/invoke.ts` | `invokeEdgeFn<T>()` — raw edge call with structured error unwrapping |
| `edge/edge.ts` | `endpoints` typed registry |
| `stripe/gateway-factory.ts` | Real vs. no-op `PaymentGateway` resolution |
| `supabase/browser.ts` | Browser Supabase client singleton |
| `supabase/server.ts` | Server-side Supabase client (SSR, cookie-aware) |
| `analytics/posthog.tsx` | PostHog provider and page view tracking |
| `flags.ts` | Feature flags (client-side PostHog evaluation) |
| `query-keys.ts` | Canonical React Query key factory |
| `geo.ts` | App-level `geo` singleton |

#### `providers/`

| File | Description |
|---|---|
| `query-provider.tsx` | Constructs `Deps`, wraps app with `DepsProvider` + `QueryClientProvider` |
| `deps-provider.tsx` | `DepsProvider` + `useDeps()` |

#### `test/`

Vitest setup only (`setup.ts`). No test cases here — tests are co-located with source.

### `supabase/functions/` (grouped by concern)

**Booking & payment**: `booking-create`, `stripe-payment-capture`, `stripe-payment-cancel`, `stripe-webhooks`

**Stripe Connect**: `stripe-connect-create`, `stripe-connect-refresh`, `stripe-connect-status`

**Markets**: `public-market-create`, `organizer-stats`

**Takeover**: `takeover-info`, `takeover-start`, `takeover-verify`, `takeover-request`, `takeover-feedback`, `takeover-remove`

**Admin**: `admin-markets-overview`, `admin-market-edit`, `admin-market-activity`, `admin-business-import`, `admin-invite-create/accept/revoke`, `admin-takeover-send/funnel/pending`, `admin-revoke`

**Block sale**: `block-sale-create`, `block-sale-stand-apply`, `block-sale-stand-confirm`, `block-sale-decide`, `block-sale-stand-edit`, `block-sale-archive`

**Subscriptions**: `skyltfonstret-checkout`, `skyltfonstret-portal`

**Infrastructure**: `cache-warmup`, `route-create-anon`

**Shared helpers** (`_shared/`): `handler.ts`, `endpoint.ts`, `public-endpoint.ts`, `auth.ts`, `cors.ts`, `stripe.ts`, `email.ts`, `email-templates/`, `claim-takeover.ts`, `takeover-token.ts`, `crypto.ts` (re-uses shared), `geocode.ts`

---

## 5. Testing strategy

### Co-location

Tests are co-located with source. `foo.ts` → `foo.test.ts` next to it. `web/src/test/` holds only `setup.ts` (Vitest globals); no test cases.

### In-memory adapters

Unit tests inject `makeInMemoryDeps(seed)` from `packages/shared/src/deps-factory.ts`. In-memory adapters are synchronous and side-effect-free. They throw on missing IDs (programmer errors) and validate status transitions. No network required.

### Contract tests

`packages/shared/src/contracts/*.test.ts` confirm that valid payloads pass and invalid ones produce the expected Zod error shape. Edge function handler tests call the exported `handle*` function with injected deps.

### Running tests

```bash
# Domain logic
cd packages/shared && node ../../node_modules/vitest/vitest.mjs run

# Web (hooks, components)
cd web && node ../node_modules/vitest/vitest.mjs run

# Type check
cd web && node ../node_modules/typescript/bin/tsc --noEmit
```

`npx` is broken in this monorepo due to hoisting. Always use explicit `node` paths.

### Deno edge functions

Typechecked with `deno check`. `*.test.ts` files inside function directories can be run with `deno test` but are not currently wired into CI. The shared-package test suite covers the pure-function core (reducers, validators, sagas).

### E2E

Playwright tests in `web/e2e/`. Run against a build with `NEXT_PUBLIC_E2E_FAKE=1` to use in-memory adapters (no real DB/Stripe). `web/src/lib/e2e/bridge.ts` exposes `window.__e2eBridge__` so tests can seed and reset data.

---

## 6. Operational notes

### Deployment

Full setup instructions for Stripe, Supabase, Cloudflare, and environment variables: `SETUP-CHECKLIST.txt`. Deploy commands: root `README.md`.

### Cron / ISR warm-up

`supabase/functions/cache-warmup/index.ts` warms the Cloudflare CDN cache for the top-200 recently-updated listings. Triggered every 30 minutes by a pg_cron job (look for `net.http_post` in `supabase/migrations/`). Authenticates with the service-role key.

### View refresh constraint

`scripts/check-view-refreshes.mjs` enforces that any migration altering a tracked table also refreshes any `SELECT t.*` views over it. This guards against a real bug: when `slug` was added to `flea_markets`, the `visible_flea_markets` view kept returning the pre-slug shape, breaking `/loppis/[slug]`.

```bash
node scripts/check-view-refreshes.mjs
```

### Edge import allowlist

`scripts/check-edge-imports.mjs` scans all `supabase/functions/**/*.ts` files and fails if any `@fyndstigen/shared/<subpath>` import is not on the explicit allowlist. The allowlist separates edge-safe code (pure domain logic, Zod schemas, Deno-compatible adapters) from code that pulls in Next.js, React, or Node built-ins.

```bash
node scripts/check-edge-imports.mjs
# → check-edge-imports: all imports OK (79 files scanned).
```

---

## 7. Known quirks / cleanup candidates

1. **Dual `api.*` and `deps.*` surfaces** — `packages/shared/src/api/` (legacy `createApi()`) is being superseded by the `Deps` container, but `domain/booking-service.ts:21` still takes a `BookingServiceApi` (`Pick<Api, 'bookings' | 'endpoints'>`) rather than individual ports. The migration is noted as incomplete in `packages/shared/src/deps.ts:15`.

2. **Snake-case type aliases in `types/index.ts`** — `packages/shared/src/types/index.ts:80` re-exports `FleaMarketRow` as `FleaMarket` and a composite as `FleaMarketDetails` for back-compat. A comment at line 4 notes ~25 remaining consumers need to be migrated to `*View` types. New code should not use the alias forms.

3. **`useRouteBuilder` edit mode not implemented** — `web/src/hooks/use-route-builder.ts:101` throws if `mode: 'edit'` is passed. The `RouteBuilderOptions` type advertises the option but it's YAGNI.

4. **`SUPABASE_ENVIRONMENT` not auto-set** — `supabase/functions/_shared/endpoint.ts:49` reads this env var to decide whether an output-contract violation throws (dev) or warns (prod). Supabase Edge does not inject it automatically; it must be set explicitly in `.env.local` or CI. Without it, contract violations on both local and CI are silent `console.error` entries.

5. **`invokeEdgeFn` bypasses the typed registry** — `web/src/lib/edge/invoke.ts:22` carries an `eslint-disable` note explaining it's a temporary escape hatch for functions not yet in the `api.endpoints` registry (RFC #39). Several block-sale and admin hooks still call it directly.

6. **`LatLng` deprecated alias** — `packages/shared/src/geo/index.ts:10` re-exports `Coord` as `LatLng` with `@deprecated`. The alias is a transparent re-export so consumers see no type error. Not clear all consumers have been updated.

7. **`react-hooks/exhaustive-deps` suppressions** — `web/src/components/map-view.tsx:108`, `web/src/hooks/route-builder/use-draft-persistence.ts:65`, and `web/src/app/profile/create-market/page.tsx:106` suppress the rule. These may hide stale-closure bugs, particularly around draft persistence.

8. **`visible_flea_markets` is the only tracked view** — `scripts/check-view-refreshes.mjs:34` has a single-entry `TABLE_VIEWS` map. Tables with views added later will not be tracked unless the script is updated manually.

9. **Orphaned PaymentIntents from old idempotency key scheme** — `supabase/functions/booking-create/index.ts:76` notes a previous version included `Date.now()` in the idempotency key, creating a new PaymentIntent on every browser retry. The fix is in place, but old orphaned intents in `requires_capture` will never be cleaned up automatically.

10. **`auth_user_email_view` dependency in `route-create-anon`** — `supabase/functions/route-create-anon/index.ts:35` queries `auth_user_email_view`, a view on the `auth` schema. This view is not in the migrations and is not documented in `SETUP-CHECKLIST.txt`.

11. **Mobile clients not in CI** — `app/` and `mobile/` import `@fyndstigen/shared` but have no build, type-check, or test step. Breaking changes to the shared public surface may silently break them.

12. **Output validation silently degrades in production** — a regression where an edge function returns an incorrect shape is invisible to users but logged to Supabase function logs (not Sentry or similar). Easy to miss unless log monitoring is in place (see quirk 4).
