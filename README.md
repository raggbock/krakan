# Fyndstigen

Svensk loppisplattform — hitta loppisar, boka bord, planera rutter.

Live: [fyndstigen.se](https://fyndstigen.se)

## Stack

- **Web** — Next.js 15 + React Query, deployar till Cloudflare Workers via OpenNext
- **Edge** — Supabase Edge Functions (Deno + TypeScript), Stripe Connect Standard med manuell capture
- **Databas** — PostgreSQL via Supabase med PostGIS för geosökningar
- **Domän** — `packages/shared` är källan-för-allt; samma TypeScript-kod körs i webben och i edge-funktioner via Denos import map

## Repo-struktur

```
packages/shared/    Domänlogik, kontrakt, errors (@fyndstigen/shared)
web/                Next.js-appen — primärprodukt
supabase/functions/ Edge functions (auth, betalningar, admin-actions, e-post)
supabase/migrations PostgreSQL-migrations
scripts/            Scrapers + bulk-import för seed-data (OSM, Erikshjälpen, Myrorna, PMU, m.fl.)
app/                React Native-klient (legacy, namnet är fortfarande "loppan"; ingår ej i CI)
mobile/             Expo-klient (nyare försök; ingår ej i CI)
```

Webben är primärprodukten. Båda mobilklienterna importerar `@fyndstigen/shared`
men byggs eller deployas inte automatiskt — kolla med ägaren innan du rör dem.

## Lokal utveckling

```bash
# Tester — web
cd web && node ../node_modules/vitest/vitest.mjs run

# Tester — domänlogik
cd packages/shared && node ../../node_modules/vitest/vitest.mjs run

# Typcheck
cd web && node ../node_modules/typescript/bin/tsc --noEmit

# Bygg + deploy staging (från repo-root)
cd web && node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build
node node_modules/wrangler/bin/wrangler.js deploy --config web/wrangler.staging.jsonc --x-autoconfig=false
```

`npx` är trasigt i monorepoet pga hoisting — använd alltid explicita `node`-paths.

## Datakällor

Seed-filerna i `supabase/seed/` kommer från flera publika källor:

- **OpenStreetMap** (`osm-flea-markets-*.json`) — hämtad via Overpass API. Licensierad under [ODbL](https://www.openstreetmap.org/copyright). Attribution: © OpenStreetMap contributors.
- **Kedjebutiker** (`erikshjalpen.json`, `myrorna.json`, `pmu.json`, etc.) — skrapad från företagens publika hemsidor med deras egna sitemaps. Innehåller endast publik kontaktinformation (butiksadresser, öppettider).
- **Manuell research** (`fyndstigen_import.json`) — hand-curated lista med Örebro-baserade loppisar, baserad på publik information.

Geokodning sker via [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap-data, max 1 req/s enligt deras användarvillkor).

## Bidrag

Detta är ett soloprojekt för tillfället, men issues och pull requests är välkomna.

## Licens

MIT — se [LICENSE](LICENSE).
