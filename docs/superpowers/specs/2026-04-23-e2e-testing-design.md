# RFC: True end-to-end-tester för frontend

**Datum:** 2026-04-23
**Status:** Draft — väntar på review innan implementation-plan skrivs.

## 1. Mål och scope

Två E2E-svit-kategorier i Playwright, körandes riktig Next.js frontend:

- **Onboarding-sviten** — arrangör skapar konto, skapar loppis, laddar upp bild, sätter öppettider, publicerar, kopplar Stripe Connect (stubbad) och accepterar en bokning med capture. Körs mot **lokal Supabase** (`supabase start`) + **stripe-mock**.
- **Karta/rutt-sviten** — besökare öppnar karta, bygger en loppisrunda, ser distans/ordning och drar om rutten. Körs mot **in-memory fake backend** (adapter-swap via `@fyndstigen/shared`) + **OSRM-fixturer**.

**Icke-mål:** testa OSRM självt, testa Stripes riktiga Connect-sidor, prestandatestning, mobilvyer (täcks separat).

## 2. Arkitektur — två profiler i samma Playwright-setup

Vi utökar befintlig `web/playwright.config.ts` med `projects` istället för en ny konfig-fil:

```
projects:
  - name: 'onboarding'   → testDir: './e2e/onboarding',  globalSetup: local-supabase
  - name: 'map'          → testDir: './e2e/map',         globalSetup: msw-fake
  - name: 'smoke'        → testDir: './e2e/smoke'        (befintlig)
```

**Onboarding-profil:**
- `supabase start` startas en gång via `globalSetup` (återanvänder körande instans lokalt; i CI alltid kall start).
- `stripe-mock` körs som Docker-container på port 12111.
- Next.js-dev startas med `.env.e2e` som pekar på lokala Supabase-URL:er och `STRIPE_API_BASE=http://localhost:12111`.
- Edge functions körs via `supabase functions serve` i samma process.

**Map-profil:**
- Ingen backend startas. Next.js körs med `NEXT_PUBLIC_E2E_FAKE=1`.
- En in-memory fake (se sektion 4) injiceras via en startup-modul som ersätter `supabaseClient`/`fetchApi`-adaptrarna från `@fyndstigen/shared`.
- OSRM-anrop interceptas med Playwrights `page.route()` mot fixturer i `e2e/fixtures/osrm/`.

## 3. Auth & Stripe-stubbning (onboarding-profilen)

### Auth-bypass — inga magic-link-mail i testerna

Test-only helper i `e2e/helpers/auth.ts` använder Supabase service-role-nyckeln (bara tillgänglig lokalt) för att:
1. Skapa user via `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
2. Logga in via vanlig `signInWithPassword` i browsern → session cookie sätts som i produktion.

Helpern exponeras som Playwright-fixture: `test.extend({ asOrganizer, asVisitor })`. Varje test får färska users med namespace-mail (`e2e-<uuid>@test.fyndstigen.se`) enligt state-strategi B.

### Stripe Connect-stubbning

Stripe Connect-onboarding redirectar normalt till `connect.stripe.com`. I E2E-profilen:
- Edge function `create-stripe-connect-link` läser env-flaggan `E2E_STRIPE_STUB=1` och returnerar URL till lokal route `/e2e/stripe-connect-return?account=acct_xxx&success=1` istället för Stripes sida.
- Testet klickar knappen → landar direkt på return-URL:en → en test-helper postar en fake `account.updated`-event till webhook-endpointen (signerad med stripe-mocks nyckel).

### Capture-steget

Betald bokning skapas mot `stripe-mock` (Payment Intent med `capture_method=manual`). Arrangören accepterar → edge function capturear → `stripe-mock` svarar med `succeeded`. Inga riktiga Stripe-anrop.

### Bilduppladdning

Riktig Supabase Storage lokalt — laddar upp en liten PNG från `e2e/fixtures/images/test-marknad.png`. Testar både client-side komprimering och Storage-policyn.

## 4. In-memory fake (map-profilen)

Kart-testerna ska vara snabba och deterministiska — ingen Supabase, inga edge-anrop. Vi utnyttjar att `@fyndstigen/shared` redan använder ports & adapters.

**Placering:** `web/src/lib/e2e/fake-backend.ts` (bundlas bara när `NEXT_PUBLIC_E2E_FAKE=1`).

**Vad den fakear:**
- `listMarkets({ bbox, openAt })` — returnerar seedade marknader från `Map<id, Market>`.
- `getMarket(id)`, `listTables(marketId)` — samma store.
- Öppettider — riktiga, evaluerade mot fixad "nu"-tid som test kan sätta via `window.__E2E__.setNow(iso)`.

**Seed-API exponerat på `window.__E2E__`:**
```ts
window.__E2E__ = {
  seed: (markets: Market[]) => void,
  reset: () => void,
  setNow: (iso: string) => void,
}
```

Testerna seedar via `page.evaluate()` innan navigering. Varje test börjar med `reset()`.

**OSRM-fixturer:**
- `e2e/fixtures/osrm/` innehåller inspelade svar namngivna efter koordinat-hash (`<sha1(coords)>.json`).
- Helpern `record-osrm-fixtures.mjs` kan köras manuellt mot publik OSRM för att regenerera fixturer när seed-koordinater ändras — checkas in i git.
- Playwright `page.route('**/router.project-osrm.org/**', ...)` returnerar matchande fixtur eller failar testet hårt om fixtur saknas (inga tysta misses).

**Varför ports & adapters, inte MSW?**
Snabbare, typat, inga `fetch`-interceptorer att underhålla för Supabase-klientens interna beteende (realtime, auth-refresh). MSW används ändå för OSRM för att slippa ändra `fetch`-koden i `route-planner.ts`.

## 5. Testscenarier (första iterationen)

### Onboarding-sviten (`e2e/onboarding/`)

1. `organizer-signup.spec.ts` — skapa konto, landa på tom dashboard.
2. `create-market.spec.ts` — skapa loppis med adress, beskrivning, ladda upp bild, sätt öppettider (återkommande + undantag), publicera. Assertera att publik sida visar marknaden.
3. `stripe-connect.spec.ts` — koppla Stripe Connect (stubbad), verifiera att `charges_enabled=true` reflekteras i UI.
4. `full-booking-capture.spec.ts` — hela flödet: arrangör har marknad + Stripe → besökare bokar bord → betalar (manual auth) → arrangör accepterar → capture → båda ser "bekräftad".
5. `free-booking-auto-accept.spec.ts` — gratis marknad med auto-accept → bokning bekräftas direkt, ingen Stripe.

### Map-sviten (`e2e/map/`)

1. `list-markets-on-map.spec.ts` — seed 5 marknader → karta visar 5 markörer på rätt koordinater, filter "öppet nu" respekterar `setNow()`.
2. `build-loppisrunda.spec.ts` — lägg till 3 marknader i rutten → OSRM-fixtur returnerar vägdragning → UI visar total distans och ordning.
3. `reorder-loppisrunda.spec.ts` — dra om ordning → ny OSRM-fixtur → distans uppdateras.
4. `empty-bbox.spec.ts` — panorera till område utan marknader → tomt state visas korrekt.

**Totalt 9 tester i MVP.** Uttryckligen out-of-scope för initiala leveransen men naturliga utökningar: cancel/refund-flöde, organizer-analytics, skyltfönster.

## 6. CI & utvecklarergonomi

### Lokal körning

```bash
# Hela sviten (startar lokal Supabase + stripe-mock automatiskt)
cd web && node ../node_modules/@playwright/test/cli.js test

# Bara map-profilen (snabb, ingen Docker)
cd web && node ../node_modules/@playwright/test/cli.js test --project=map

# Bara en fil, headed för debugging
... test --project=onboarding --headed onboarding/create-market.spec.ts
```

Förutsättningar dokumenteras i `web/e2e/README.md`: Docker Desktop (för stripe-mock), Supabase CLI. Om dessa saknas skippar `globalSetup` onboarding-profilen med tydligt felmeddelande istället för kryptisk timeout.

### CI (GitHub Actions)

- Ny workflow `.github/workflows/e2e.yml`, triggas på PR mot `main`.
- Två jobs i parallell: `e2e-map` (snabb, ~2 min, inga extra tjänster) och `e2e-onboarding` (Docker-baserad, ~6–8 min).
- `supabase/cli`-action startar lokal Supabase i CI. `stripe-mock` körs som service-container.
- Artifacts: Playwright-trace + screenshots laddas upp vid fail.
- Onboarding-jobbet markeras initialt **non-blocking** (`continue-on-error: true`) tills det stabiliserats över ~20 gröna körningar, sedan blocking.

### Flakiness-policy

- `retries: 1` i CI (redan konfigurerat).
- Test som flakar 3 gånger på en vecka quarantine-märks via `test.fixme()` med länk till issue — hellre pausad flaky test än ignorerad.
- `trace: 'on-first-retry'` redan satt — räcker för felsökning.

### Scripts i `web/package.json`

```json
"e2e": "playwright test",
"e2e:map": "playwright test --project=map",
"e2e:onboarding": "playwright test --project=onboarding",
"e2e:fixtures": "node e2e/helpers/record-osrm-fixtures.mjs"
```

## 7. State-strategi

**Strategi B — namespacing per test-run.** Varje test genererar unika emails/slugs (t.ex. `e2e-<uuid>@test.fyndstigen.se`). Data städas efter körning men tester delar DB under körning. Snabbt, parallelliserbart.

**Opt-in strategi A** (truncate + seed) för tester som behöver tom DB (t.ex. "första loppisen som skapas"). Markeras via `test.describe.configure({ mode: 'serial' })` + explicit cleanup-fixture.

## 8. Risker & öppna frågor

### Risker

1. **Lokal Supabase-start är långsam (20–40s kall start).** Mitigering: `globalSetup` återanvänder körande instans lokalt; i CI cachas Docker-layers. Onboarding-sviten förblir opt-in lokalt.
2. **OSRM-fixturer rotnar när seed-koordinater ändras.** Mitigering: helpern `record-osrm-fixtures.mjs` + tydligt felmeddelande ("fixture missing för koord-hash X — kör `npm run e2e:fixtures`"). Fixturer ägs av den som ändrar seed.
3. **stripe-mock täcker inte 100 % av Stripe-API.** Capture, PaymentIntent och Connect-account-endpoints fungerar väl; edge-cases (disputes, refund-sekvenser) kan avvika. För MVP räcker det.
4. **Auth-bypass via service-role läcker i prod om env-flagga fel-sätts.** Mitigering: service-role och `E2E_STRIPE_STUB` används bara när `NODE_ENV !== 'production'` **och** `ALLOW_E2E_HOOKS=1` är satt. Test-helpers ligger under `e2e/` och importeras aldrig från app-koden.
5. **Bilduppladdning mot lokal Storage täcker inte prod-bucket-policyn.** Mitigering: staging-smoke-test kör bilduppladdning mot riktig Supabase som sanity-check.
6. **Parallellism + namespaced data kan kollidera på globala singletons** (t.ex. "enda featured marknaden"). Mitigering: identifiera sådana i setup, markera med `test.describe.serial()`.

### Öppna frågor

- Exakt hur `@fyndstigen/shared`-adaptrarna ska swappas i browsern (globalt objekt vs. module alias via Next-config). Beslutas i plan-fasen efter kort spike.
- Om stripe-mock-versionen stödjer `application_fee_amount` + `on_behalf_of` korrekt för Connect Standard — verifieras i första PR:en.
- Ska onboarding-sviten köras mot staging som rök-test nattligen? Förslag: ja, men med `test.skip()` för Stripe Connect-stegen (ingen service-role där). Lämnas som uppföljning.
