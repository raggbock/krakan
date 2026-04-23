# E2E tests

Playwright tests split into three **profiles**:

- `smoke` — public-page smokes. No backend mocking. Runs against local dev.
- `map` — map/route UI tests. In-memory adapter swap via `NEXT_PUBLIC_E2E_FAKE=1`, OSRM fixtures.
- `onboarding` — full onboarding + booking flows. Requires local Supabase + stripe-mock (Docker).

## Commands

```bash
cd web
npm run e2e                  # everything (requires Docker for onboarding)
npm run e2e:smoke            # public-page smokes
npm run e2e:map              # map/route tests (fast, no Docker)
npm run e2e:onboarding       # onboarding + booking (Docker required)
```

## Prerequisites

- **Map + smoke:** nothing beyond the repo.
- **Onboarding:** Docker Desktop running, Supabase CLI (`supabase --version`). See `docs/superpowers/specs/2026-04-23-e2e-testing-design.md`.

## Fixtures

OSRM fixtures live in `e2e/fixtures/osrm/<sha1-of-coords>.json`. Regenerate with `npm run e2e:fixtures`.
