# Fyndstigen

Swedish flea market platform — discover markets, book tables, plan routes.

## Monorepo structure

```
packages/shared/    — Domain logic, types, ports & adapters (@fyndstigen/shared)
web/                — Next.js frontend (Cloudflare Workers deploy) — primary product
supabase/functions/ — Supabase Edge Functions (Deno, Stripe payments)
supabase/migrations — PostgreSQL migrations
scripts/            — Seed-data scrapers + bulk-import (OSM, chain stores)
app/                — React Native client (legacy, name still "loppan"; not in CI)
mobile/             — Expo client (newer attempt; not in CI)
```

The web app is the primary product. Both mobile clients import `@fyndstigen/shared`
but are not built or deployed by CI; check with the maintainer before touching them.

## Key architecture decisions

- **Stripe Connect Standard** — organizers have their own Stripe accounts
- **Manual capture** — card authorized at booking, captured on organizer approval
- **12% platform commission** as Stripe application fee
- **Edge function middleware** (`supabase/functions/_shared/handler.ts`) — auth, CORS, error handling
- **`@fyndstigen/shared` is the canonical source** for all domain logic (commission, booking outcomes, validation). Edge functions import directly from `@fyndstigen/shared/booking` and `@fyndstigen/shared/booking-lifecycle` via `supabase/functions/deno.json` (import map + sloppy-imports). No manual mirrors.
- **Free bookings** skip Stripe entirely — no PaymentIntent created
- **Auto-accept** markets confirm bookings instantly (free) or on payment (paid)

## Commands

All commands must use explicit `node` paths — `npx` is broken in this monorepo due to hoisting.

```bash
# Tests — web (hooks, components)
cd web && node ../node_modules/vitest/vitest.mjs run

# Tests — shared (domain logic)
cd packages/shared && node ../../node_modules/vitest/vitest.mjs run

# Type check
cd web && node ../node_modules/typescript/bin/tsc --noEmit

# Build staging (run from repo root)
cd web && node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build

# Deploy staging (MUST run from repo root)
node node_modules/wrangler/bin/wrangler.js deploy --config web/wrangler.staging.jsonc --x-autoconfig=false
```

## Conventions

- UI text is in **Swedish**
- Types are defined in `packages/shared/src/types.ts` and re-exported via `web/src/lib/api.ts`
- Map markers use shared utilities from `web/src/lib/map-markers.ts`
- React Query hooks follow the pattern: `queryKeys` in `web/src/lib/query-keys.ts`
- Edge functions use `createHandler()` from `_shared/handler.ts`
- **Tests are co-located with source.** `foo.ts` → `foo.test.ts` next to it.
  No `__tests__/` directories. The lone `web/src/test/` directory holds
  vitest setup only (`setup.ts`), not test cases.

## Important files

- `SETUP-CHECKLIST.txt` — Manual setup steps for Stripe, Supabase, Cloudflare
- `packages/shared/src/booking.ts` — Canonical booking/payment logic
- `packages/shared/src/booking-lifecycle.ts` — Canonical booking lifecycle reducer
- `supabase/functions/deno.json` — Deno import map (maps `@fyndstigen/shared/` → `../../packages/shared/src/`)
- `web/src/hooks/use-booking.ts` — Main booking hook (free + paid flows)
- `web/src/components/bookable-tables-card.tsx` — Booking UI component

@web/AGENTS.md
