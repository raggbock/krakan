# Fyndstigen

Swedish flea market platform — discover markets, book tables, plan routes.

## Monorepo structure

```
packages/shared/    — Domain logic, types, ports & adapters (@fyndstigen/shared)
web/                — Next.js frontend (Cloudflare Workers deploy)
supabase/functions/ — Supabase Edge Functions (Deno, Stripe payments)
supabase/migrations — PostgreSQL migrations
```

## Key architecture decisions

- **Stripe Connect Standard** — organizers have their own Stripe accounts
- **Manual capture** — card authorized at booking, captured on organizer approval
- **12% platform commission** as Stripe application fee
- **Edge function middleware** (`supabase/functions/_shared/handler.ts`) — auth, CORS, error handling
- **`@fyndstigen/shared` is the canonical source** for all domain logic (commission, booking outcomes, validation). `supabase/functions/_shared/pricing.ts` is a manual mirror for Deno — keep them in sync.
- **Free bookings** skip Stripe entirely — no PaymentIntent created
- **Auto-accept** markets confirm bookings instantly (free) or on payment (paid)

## Commands

All commands must use explicit `node` paths — `npx` is broken in this monorepo due to hoisting.

```bash
# Tests — web (hooks, components)
cd web && node ../node_modules/vitest/vitest.mjs run

# Tests — shared (domain logic, 271 tests)
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

## Important files

- `SETUP-CHECKLIST.txt` — Manual setup steps for Stripe, Supabase, Cloudflare
- `packages/shared/src/booking.ts` — Canonical booking/payment logic
- `supabase/functions/_shared/pricing.ts` — Mirror of booking.ts for Deno edge functions
- `web/src/hooks/use-booking.ts` — Main booking hook (free + paid flows)
- `web/src/components/bookable-tables-card.tsx` — Booking UI component

@web/AGENTS.md
