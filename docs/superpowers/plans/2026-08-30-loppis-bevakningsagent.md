# Loppis-bevakningsagent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg en kontinuerlig import av småorts-loppisar från öppna lokala källor, med GSC-driven stadsprioritering och en kvalitetsgrind som ersätter mänsklig granskning.

**Architecture:** En delad, källoberoende import-kärna (`_loppis-import-karna.md`) med två tunna framsidor: `bevaka-lokala-kallor` (obemannad, WebSearch/WebFetch, cron) och `importera-loppisar` (bemannad, Claude-in-Chrome, oförändrad ToS-spärr). Kärnan äger dedup, kategorier, geo-mekanik och skrivmallar.

**Tech Stack:** Claude Code skills (markdown), PostgreSQL/PostGIS via Supabase MCP, TypeScript i `@fyndstigen/shared`, vitest.

**Spec:** `docs/superpowers/specs/2026-08-30-loppis-bevakningsagent-design.md`

## Global Constraints

- UI-text och skill-text är på **svenska**.
- Tester ligger **co-located**: `foo.ts` → `foo.test.ts` bredvid. Inga `__tests__/`.
- Alla kommandon använder explicita `node`-sökvägar — `npx` är trasigt i monorepot.
- Testkommando för shared: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
- System-organizer-id: `f1d57000-1000-4000-8000-000000000001`
- `day_of_week`: **0=sön, 1=mån … 6=lör**
- `lat`/`long` på `flea_markets` är **genererade** från `location` — sätt dem aldrig.
- `slug` sätts av trigger på `flea_markets` — sätt den aldrig manuellt. På `block_sales` sätts den manuellt.
- Tillåtna `category`-värden (CHECK-constraint): `'Privat'`, `'Kyrklig-bistånd'`, `'Antik-retro'`, `'Kommunal'`, `'Kedja'`, `'Evenemang'`. `null` om osäker.
- **Rör aldrig rader med `is_deleted = true`.**
- Nästa lediga migrationsnummer: `00064`.

---

### Task 1: Skiftlägesokänslig ortsammanslagning

Två rader i databasen har `city` = `Upplands väsby` respektive `Upplands Väsby`. `slugifyCity` gemenerar båda till `upplands-vasby`, men `aggregateCitiesByCanonical` behandlar dem som två städer. `resolveCity` i hubbsidan gör `.find()` och tar första träffen, så den andra ortens loppis blir **osynlig** på `/loppisar/upplands-vasby`. Detta är en befintlig bugg som agenten annars skulle producera fler av.

**Files:**
- Modify: `packages/shared/src/city-aliases.ts`
- Test: `packages/shared/src/city-aliases.test.ts`

**Interfaces:**
- Consumes: `canonicalCity(raw: string): string`, `CITY_ALIASES: Record<string, string>` (befintliga)
- Produces: `canonicalCity` blir skiftlägesokänslig vid alias-uppslag. `aggregateCitiesByCanonical(rows)` grupperar skiftlägesvarianter till **en** post vars `rawLabels` innehåller **alla** råa varianter. Signaturerna är oförändrade.

**Val av visningsetikett** när flera skiftlägesvarianter finns, i ordning: (1) den vanligast förekommande, (2) den med flest versaler, (3) lexikografiskt först. Deterministiskt och ger `Upplands Väsby` framför `Upplands väsby`.

- [ ] **Step 1: Write the failing tests**

Lägg till i `packages/shared/src/city-aliases.test.ts`:

```typescript
describe('skiftlägesokänslig ortsammanslagning', () => {
  it('folds a district regardless of casing', () => {
    expect(canonicalCity('södermalm')).toBe('Stockholm')
    expect(canonicalCity('SÖDERMALM')).toBe('Stockholm')
  })

  it('merges casing variants into one city with all raw labels', () => {
    const rows = [
      { city: 'Upplands väsby', updatedAt: '2026-01-01' },
      { city: 'Upplands Väsby', updatedAt: '2026-01-02' },
    ]
    const result = aggregateCitiesByCanonical(rows)
    expect(result).toHaveLength(1)
    expect(result[0].marketCount).toBe(2)
    expect(result[0].rawLabels.sort()).toEqual(['Upplands Väsby', 'Upplands väsby'])
  })

  it('picks the properly-cased label as the display name', () => {
    const rows = [
      { city: 'Upplands väsby', updatedAt: '2026-01-01' },
      { city: 'Upplands Väsby', updatedAt: '2026-01-02' },
    ]
    expect(aggregateCitiesByCanonical(rows)[0].city).toBe('Upplands Väsby')
  })

  it('picks the most frequent label when casing differs', () => {
    const rows = [
      { city: 'nora', updatedAt: '2026-01-01' },
      { city: 'nora', updatedAt: '2026-01-02' },
      { city: 'Nora', updatedAt: '2026-01-03' },
    ]
    expect(aggregateCitiesByCanonical(rows)[0].city).toBe('nora')
  })

  it('keeps distinct cities distinct', () => {
    const rows = [
      { city: 'Nora', updatedAt: '2026-01-01' },
      { city: 'Norra Djurgården', updatedAt: '2026-01-02' },
    ]
    const cities = aggregateCitiesByCanonical(rows).map((r) => r.city).sort()
    expect(cities).toEqual(['Nora', 'Stockholm'])
  })

  it('rawLabelsFor collects casing variants', () => {
    const labels = ['Upplands Väsby', 'Upplands väsby', 'Nora']
    expect(rawLabelsFor('Upplands Väsby', labels).sort()).toEqual([
      'Upplands Väsby',
      'Upplands väsby',
    ])
  })
})
```

`rawLabelsFor` måste med: den bygger `.in('city', …)`-listan som hämtar
marknaderna. Missar den en skiftlägesvariant förblir den ortens loppis osynlig
även efter att aggregeringen slagits ihop.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run city-aliases`
Expected: FAIL — `canonicalCity('södermalm')` returnerar `'södermalm'`, och sammanslagningstestet ger 2 poster i stället för 1.

- [ ] **Step 3: Make the alias lookup case-insensitive**

I `packages/shared/src/city-aliases.ts`, lägg till ett gemenformat index efter `CITY_ALIASES`-deklarationen och använd det i `canonicalCity`:

```typescript
/** Lowercased alias index — built once, so canonicalCity is case-insensitive. */
const ALIAS_INDEX_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_ALIASES).map(([district, parent]) => [district.toLowerCase(), parent]),
)
```

Ersätt kroppen i `canonicalCity`:

```typescript
  return ALIAS_INDEX_LOWER[raw.toLowerCase()] ?? raw
```

- [ ] **Step 4: Group by lowercased canonical and pick a display label**

I `aggregateCitiesByCanonical`, byt nyckel till gemener och samla etikettfrekvens. Ersätt funktionen med:

```typescript
export function aggregateCitiesByCanonical(
  rows: Array<{ city: string | null; updatedAt: string }>,
): Array<{ city: string; marketCount: number; latestUpdate: string; rawLabels: string[] }> {
  const byKey = new Map<
    string,
    { marketCount: number; latestUpdate: string; rawLabels: Set<string>; labelCounts: Map<string, number> }
  >()
  for (const row of rows) {
    if (!row.city) continue
    const canonical = canonicalCity(row.city)
    const key = canonical.toLowerCase()
    const cur = byKey.get(key)
    if (cur) {
      cur.marketCount += 1
      if (row.updatedAt > cur.latestUpdate) cur.latestUpdate = row.updatedAt
      cur.rawLabels.add(row.city)
      cur.labelCounts.set(canonical, (cur.labelCounts.get(canonical) ?? 0) + 1)
    } else {
      byKey.set(key, {
        marketCount: 1,
        latestUpdate: row.updatedAt,
        rawLabels: new Set([row.city]),
        labelCounts: new Map([[canonical, 1]]),
      })
    }
  }
  return Array.from(byKey.values()).map((v) => ({
    city: pickDisplayLabel(v.labelCounts),
    marketCount: v.marketCount,
    latestUpdate: v.latestUpdate,
    rawLabels: Array.from(v.rawLabels),
  }))
}

/**
 * Pick one display label among casing variants: most frequent, then most
 * uppercase characters (proper-noun casing), then lexicographically first.
 */
function pickDisplayLabel(counts: Map<string, number>): string {
  const upperCount = (s: string) => s.split('').filter((c) => c !== c.toLowerCase()).length
  return Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    const u = upperCount(b[0]) - upperCount(a[0])
    if (u !== 0) return u
    return a[0].localeCompare(b[0], 'sv')
  })[0][0]
}
```

- [ ] **Step 5: Make `rawLabelsFor` case-insensitive**

Den jämför i dag `canonicalCity(l) === canonical` skiftlägeskänsligt och skulle
tappa varianten. Ersätt kroppen i `packages/shared/src/city-aliases.ts`:

```typescript
export function rawLabelsFor(canonical: string, allLabels: string[]): string[] {
  const target = canonicalCity(canonical).toLowerCase()
  return allLabels.filter((l) => canonicalCity(l).toLowerCase() === target)
}
```

- [ ] **Step 6: Run the full shared suite**

Run: `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`
Expected: PASS, inklusive de befintliga `canonicalizeNearbyCities`-testerna.

- [ ] **Step 7: Verify the web build still type-checks**

Run: `cd web && node ../node_modules/typescript/bin/tsc --noEmit`
Expected: inga fel. Signaturerna är oförändrade, så `resolveCity` i `web/src/app/loppisar/[city]/page.tsx` behöver ingen ändring.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/city-aliases.ts packages/shared/src/city-aliases.test.ts
git commit -m "fix(shared): fold city casing variants into one hub

Upplands vasby / Upplands Vasby slugified to the same hub but aggregated
as two cities, so resolveCity's .find() picked one and the other city's
market was invisible on /loppisar/upplands-vasby."
```

---

### Task 2: Migration — `source_url` för härkomst

Den strikta grinden kräver att varje automatiskt publicerad rad är spårbar till sin källa. `contact_website` duger inte — det är verksamhetens egen sajt, inte var vi hittade uppgiften.

**Files:**
- Create: `supabase/migrations/00064_source_url.sql`

**Interfaces:**
- Produces: `flea_markets.source_url text null`, `block_sales.source_url text null`. Läses av kärnans grind i Task 4 och skrivs av `bevaka-lokala-kallor` i Task 5.

- [ ] **Step 1: Write the migration**

Skapa `supabase/migrations/00064_source_url.sql`:

```sql
-- Provenance for auto-imported rows: where we found the listing.
-- Distinct from contact_website, which is the business's own site.
-- Null for rows created by a human or by the manned FB round.
alter table public.flea_markets add column if not exists source_url text;
alter table public.block_sales  add column if not exists source_url text;

comment on column public.flea_markets.source_url is
  'Where this listing was found (kommun calendar, parish page, …). Required by the strict quality gate before an unattended import may publish. Not the business''s own website — that is contact_website.';
comment on column public.block_sales.source_url is
  'Where this listing was found. See flea_markets.source_url.';
```

- [ ] **Step 2: Apply the migration**

Använd Supabase MCP `apply_migration` med namn `00064_source_url` och innehållet ovan.

- [ ] **Step 3: Verify the columns exist and are nullable**

Kör via MCP `execute_sql`:

```sql
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema='public' and column_name='source_url'
order by table_name;
```

Expected: två rader, `block_sales` och `flea_markets`, båda `is_nullable = YES`.

- [ ] **Step 4: Verify existing rows are unaffected**

```sql
select count(*) as total, count(source_url) as med_kalla from public.flea_markets;
```

Expected: `med_kalla = 0`, `total = 1232`. Migrationen får inte ha rört befintlig data.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00064_source_url.sql
git commit -m "feat(db): add source_url provenance column to flea_markets and block_sales"
```

---

### Task 3: Datastädning — ortsskiftläge och felparsad ort

Task 1 gör koden robust mot skiftlägesvarianter; den här uppgiften städar de rader som redan finns.

**Files:**
- Create: `supabase/migrations/00065_city_data_cleanup.sql`

**Interfaces:**
- Consumes: inget. Fristående datamigration.
- Produces: inget kodgränssnitt. Efteråt finns ingen ort som skiljer sig enbart på skiftläge, och `Öst-Tegs industriområde` är borta som ort.

- [ ] **Step 1: Inspect what will change before writing anything**

Kör via MCP `execute_sql` och spara utfallet:

```sql
-- Skiftlägesdubbletter:
select lower(city) as nyckel, array_agg(distinct city) as varianter, count(*) as rader
from public.flea_markets
where is_deleted is not true and city is not null
group by lower(city)
having count(distinct city) > 1;

-- Den felparsade orten:
select id, name, city, street, zip_code
from public.flea_markets
where city = 'Öst-Tegs industriområde';
```

Förväntat: minst `Upplands väsby`/`Upplands Väsby`, och en rad i Umeå med ort `Öst-Tegs industriområde`. Om fler dubbletter dyker upp ska de med i migrationen nedan — utöka `values`-listan.

- [ ] **Step 2: Write the migration**

Skapa `supabase/migrations/00065_city_data_cleanup.sql`. Ersätt `values`-listan med det Step 1 faktiskt gav:

```sql
-- Collapse city names that differ only by casing. slugifyCity() lowercases,
-- so these produced one hub slug but two aggregated cities — the hub's
-- resolveCity().find() picked one and hid the other city's markets.
update public.flea_markets m
   set city = v.canonical
  from (values
    ('upplands väsby', 'Upplands Väsby')
  ) as v(nyckel, canonical)
 where lower(m.city) = v.nyckel
   and m.city <> v.canonical
   and m.is_deleted is not true;

-- 'Öst-Tegs industriområde' is a district of Umeå that was parsed into the
-- city column. The market is PMU Second Hand on Lärlingsgatan in Umeå.
update public.flea_markets
   set city = 'Umeå'
 where city = 'Öst-Tegs industriområde'
   and is_deleted is not true;
```

- [ ] **Step 3: Apply the migration**

Använd Supabase MCP `apply_migration` med namn `00065_city_data_cleanup`.

- [ ] **Step 4: Verify no casing duplicates remain**

```sql
select lower(city) as nyckel, array_agg(distinct city) as varianter
from public.flea_markets
where is_deleted is not true and city is not null
group by lower(city)
having count(distinct city) > 1;
```

Expected: 0 rader.

- [ ] **Step 5: Verify both Upplands Väsby markets now share one hub**

```sql
select city, name from public.visible_flea_markets
where lower(city) = 'upplands väsby' order by name;
```

Expected: 2 rader, båda med `city = 'Upplands Väsby'`.

- [ ] **Step 6: Verify the Umeå fix**

```sql
select city, name, street from public.visible_flea_markets
where name ilike '%pmu%' and street ilike '%lärlingsgatan%';
```

Expected: 1 rad med `city = 'Umeå'`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/00065_city_data_cleanup.sql
git commit -m "fix(db): collapse city casing duplicates and correct Ost-Tegs to Umea"
```

---

### Task 4: Bryt ut den delade import-kärnan

Steg 2–6 i dagens `importera-loppisar` är källoberoende. De flyttas till en delad fil så att båda framsidorna delar dedup, kategorier, geo-mekanik och skrivmallar. **Utbrytningen får inte ändra FB-grenens beteende.**

**Files:**
- Create: `.claude/skills/_loppis-import-karna.md`
- Modify: `.claude/skills/importera-loppisar/SKILL.md`

**Interfaces:**
- Produces: kärnan tar emot två indata från framsidan:
  - `grind: strikt | granskad` — styr publiceringsbeslutet (tabellen i Step 2 nedan).
  - `kandidater` — lista med rå text plus valfri `source_url` per kandidat.
  Kärnan producerar en granska-tabell och, efter tillåtelse enligt grind, skrivningar till `flea_markets`/`block_sales`.

- [ ] **Step 1: Create the shared core with the source-independent steps**

Skapa `.claude/skills/_loppis-import-karna.md`. Kopiera avsnitten **Steg 2 — Extrahera & klassificera**, **Steg 3 — Berika**, **Steg 4 — Deduplicera**, **Steg 5 — Granska-tabell** och **Steg 6 — Skriv** ordagrant från `.claude/skills/importera-loppisar/SKILL.md`, med dessa ändringar:

I Steg 4, före dedup-frågorna, lägg till:

```markdown
**Normalisera orten före matchning.** Jämför alltid `lower(trim(city))`, aldrig
rå sträng. Två orter som skiljer sig på skiftläge är samma ort och delar
hubbsida — att skapa en ny rad med avvikande skiftläge splittrar hubben.
```

I Steg 6, i `insert`-mallarna för både `flea_markets` och `block_sales`, lägg till kolumnen `source_url` sist i kolumnlistan och `'<käll-url el. null>'` sist i `values`.

- [ ] **Step 2: Add the two-level quality gate to the core**

Lägg till detta avsnitt i `_loppis-import-karna.md`, före Steg 6:

```markdown
## Kvalitetsgrind

Framsidan anger `grind: granskad` (människa ser tabellen) eller `grind: strikt`
(ingen människa mellan fynd och publicering).

| Krav | granskad | strikt |
|---|---|---|
| Geokod löser på gatunivå | flagga om nej | krav för publicering |
| `source_url` satt | — | krav för publicering |
| Specifikt namn (ej "Second Hand" utan gata) | flagga | krav |
| Identifierbar organisation bakom | — | krav |
| Osäker `is_permanent` | flagga | skriv gömd |
| Klarar inte kraven | flagga för beslut | skriv gömd, publicera ej |

Under `strikt`: **släng aldrig** en kandidat som missar ett krav. Skriv den med
`published_at = null` så den hamnar i `/admin/markets` för granskning. Inget
arbete går förlorat och felen blir inspekterbara.

**Event får lösare grind än permanenta butiker.** Ett `block_sales` förfaller av
sig självt och har ingen ägare som kan bli felrepresenterad; en felaktig
permanent butik ligger kvar och skadar både användare och verksamheten. Konkret:
event får publiceras på postnummer-centroid, permanenta butiker inte.

Oförändrat oavsett nivå: rör aldrig `is_deleted = true`-rader.
```

- [ ] **Step 3: Slim the FB skill down to its own steps**

I `.claude/skills/importera-loppisar/SKILL.md`, ersätt hela blocket från `### Steg 2 — Extrahera & klassificera` till och med slutet av `### Steg 6` med:

```markdown
### Steg 2–6 — delad kärna

Följ `.claude/skills/_loppis-import-karna.md` med `grind: granskad`.

Dry-run gäller fortfarande: kärnan stannar vid granska-tabellen och skriver
ingenting förrän du svarat med ett urval och "kör".
```

Behåll oförändrat: frontmatter, hela avsnittet **Säkerhet & Facebooks villkor**, **Förutsättningar**, **Steg 1 — Läs gruppen** och **Mekanik-referens**. Ta bort avsnittet **Kvalitetsgrind (defaults)** — det bor nu i kärnan.

- [ ] **Step 4: Add optional city targeting to the FB skill**

Lägg till i `importera-loppisar/SKILL.md` direkt efter **Förutsättningar**:

```markdown
## Valfri ortstyrning

Anropet kan innehålla en ortlista (t.ex. från `bevaka-lokala-kallor`s
prioritering). Prioritera då inlägg och event som rör de orterna; ignorera
listan om gruppen inte täcker dem.
```

- [ ] **Step 5: Regression-verify the FB branch**

Kör `importera-loppisar` mot en FB-grupp som körts tidigare, med samma djup. Stanna vid granska-tabellen — skriv ingenting.

Expected: tabellen innehåller samma kandidater med samma NY/DUBBLETT/GÖMD-klassning som före utbrytningen. Skiljer den sig har utbrytningen ändrat beteende — jämför kärnans text mot git-historiken för `SKILL.md` och rätta avvikelsen innan du går vidare.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/_loppis-import-karna.md .claude/skills/importera-loppisar/SKILL.md
git commit -m "refactor(skill): extract source-independent import core

Steps 2-6 are source-independent. Sharing them keeps dedup, categories and
write templates in one place instead of diverging between the FB round and
the unattended source watcher."
```

---

### Task 5: Ny skill `bevaka-lokala-kallor` — endast dry-run

Skapas medvetet **utan skrivförmåga** i den här uppgiften. Skrivning aktiveras först i Task 7, efter att Task 6 mätt träffkvaliteten.

**Files:**
- Create: `.claude/skills/bevaka-lokala-kallor/SKILL.md`

**Interfaces:**
- Consumes: `_loppis-import-karna.md` steg 2–5 med `grind: strikt`.
- Produces: en rapport per körning: kandidater med grind-utfall, per ort. Inga DB-skrivningar.

- [ ] **Step 1: Write the skill file**

Skapa `.claude/skills/bevaka-lokala-kallor/SKILL.md`:

````markdown
---
name: bevaka-lokala-kallor
description: Leta upp loppisar och kvartersloppisar i prioriterade småorter via öppna lokala källor (kommunkalendrar, församlingar, hembygdsföreningar) och importera dem via den delade kärnan. Obemannad — läser aldrig Facebook.
disable-model-invocation: true
---

# Bevaka lokala källor

Obemannad rutin. Väljer orter där efterfrågan överstiger utbudet, letar upp
loppisar i öppna lokala källor och kör dem genom den delade import-kärnan.

## Aldrig Facebook

Den här skillen läser **aldrig** Facebook, Instagram eller något som kräver
inloggning. Obemannad läsning av FB-grupper bryter mot Facebooks villkor och
riskerar kontot. FB-grupper hanteras av `importera-loppisar`, som kräver att en
människa har fliken öppen.

## Läge

**Dry-run tills vidare.** Kör steg 2–5 i kärnan och rapportera. Skriv ingenting
till databasen. (Skrivning aktiveras när träffkvaliteten är validerad.)

## Steg 1 — Välj orter

Poäng per ort: `visningar_28d / max(1, antal_synliga)`.

Hämta efterfrågan via GSC-MCP:
`get_search_analytics(site_url='sc-domain:fyndstigen.se', days=28, dimensions='page', row_limit=200)`
och behåll sidor under `/loppisar/`. Sluggen efter `/loppisar/` är orten.

Hämta utbudet:

```sql
select city, count(*) as synliga from public.visible_flea_markets group by city;
```

Regler:
- Endast orter med **visningar < 250**. Över den tröskeln biter auktoritetstaket
  och mer innehåll ger bevisligen ingen positionsvinst. (Riktlinje, inte hård
  gräns — en ort strax över med bara 1 synlig loppis får tas med.)
- Orter med ≤2 synliga men utan GSC-data får baspoäng **10**.
- Hoppa över orter som körts de senaste **30 dagarna** (se Körlogg).
- Ta de **5–8** högsta.

## Steg 2 — Hitta källor per ort

WebSearch per ort med mönstren:
`<ort> kommun evenemang`, `<ort> loppis`, `<ort> hembygdsförening`,
`<ort> församling second hand`, `<ort> byalag`, `<ort> loppmarknad <år>`.

Behåll träffar som ser ut som organisationer: kommun, församling, förening,
lokaltidning. **Uteslut** Facebook, Instagram, Blocket, Tradera och
loppis-aggregatorer som konkurrerar med oss.

## Steg 3 — Läs och extrahera

WebFetch varje kandidatsida. Sätt `source_url` till den sida kandidaten lästes
från — den är obligatorisk för publicering under strikt grind.

Kör innehållet genom `.claude/skills/_loppis-import-karna.md` steg 2–5 med
`grind: strikt`.

## Steg 4 — Rapportera

Presentera per ort:

| Ort | Kandidat | Källa | Geo | Typ | Grind |
|---|---|---|---|---|---|
| Fagersta | Fagersta Second Hand | fagersta.se/evenemang | gata ✅ | perm | KLARAR |
| Fagersta | "Loppis i hallen" | fagersta.se/evenemang | postnr ⚠️ | event | KLARAR (event) |
| Arlöv | Second Hand | burlov.se | misslyckad ❌ | perm | GÖMD — geo+namn |

Avsluta med orter som gav noll träffar — de säger något om källornas värde.

## Körlogg

Skriv efter varje körning en rad per ort till
`.claude/skills/bevaka-lokala-kallor/korlogg.md`:
`YYYY-MM-DD | <ort> | <antal kandidater> | <antal som klarade grinden>`

Loggen driver 30-dagarskylningen i Steg 1 och gör träffkvaliteten mätbar över tid.
````

- [ ] **Step 2: Create the run log with a header**

Skapa `.claude/skills/bevaka-lokala-kallor/korlogg.md`:

```markdown
# Körlogg — bevaka-lokala-kallor

Datum | Ort | Kandidater | Klarade grinden
---|---|---|---
```

- [ ] **Step 3: Verify the skill loads and refuses Facebook**

Kör skillen och be den, som en del av körningen, redogöra för vilka källor den
tänker läsa för en ort.

Expected: den listar kommun-/förenings-/församlingssidor och nämner uttryckligen
att Facebook är uteslutet. Om den föreslår en FB-URL är avsnittet **Aldrig
Facebook** för svagt formulerat — skärp det innan du går vidare.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/bevaka-lokala-kallor/
git commit -m "feat(skill): add bevaka-lokala-kallor (dry-run only)

Unattended watcher over open local sources. No write capability yet - that
lands after the hit-quality validation gate."
```

---

### Task 6: Valideringsgrind — mät träffkvaliteten innan skrivning

Detta är ett **beslutssteg**, inte en kodändring. Spec:en pekar ut träffkvalitet på öppna källor som designens enda obevisade antagande. Faller det ut svagt är rätt åtgärd att lägga ned den obemannade grenen och behålla den bemannade FB-rundan med prioritering.

**Files:**
- Create: `.claude/skills/bevaka-lokala-kallor/validering-2026-08-30.md`

**Interfaces:**
- Consumes: `bevaka-lokala-kallor` i dry-run från Task 5.
- Produces: ett go/no-go-beslut för Task 7.

- [ ] **Step 1: Run the watcher against two towns**

Kör `bevaka-lokala-kallor` i dry-run mot **Fagersta** och **Forshaga**. Båda har 1 synlig loppis och bevisad efterfrågan (235 respektive 138 visningar/28d).

- [ ] **Step 2: Verify each candidate by hand**

Öppna varje kandidats `source_url` och kontrollera: finns verksamheten, stämmer adressen, är klassningen permanent/event rätt?

- [ ] **Step 3: Record the numbers**

Skriv `.claude/skills/bevaka-lokala-kallor/validering-2026-08-30.md`:

```markdown
# Validering 2026-08-30 — Fagersta & Forshaga

| Ort | Kandidater | Klarade grinden | Manuellt korrekta | Falska positiva |
|---|---|---|---|---|
| Fagersta | | | | |
| Forshaga | | | | |

**Precision** (korrekta / klarade grinden):
**Utbyte** (korrekta per ort):

## Beslut
```

- [ ] **Step 4: Apply the decision rule**

- **Precision ≥ 90 % och ≥ 1 korrekt kandidat per ort i snitt** → go. Fortsätt till Task 7.
- **Precision < 90 %** → grinden är för lös. Skärp den i kärnan och kör om Step 1–3 innan du går vidare.
- **< 1 korrekt kandidat per ort** → källorna bär inte. **Stanna här.** Lägg ned den obemannade grenen enligt spec:ens riskavsnitt, behåll Task 1–4 (de är värdefulla oavsett) och lägg i stället prioriteringen från Steg 1 i FB-rundan.

Skriv utfallet och beslutet under `## Beslut` i filen.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/bevaka-lokala-kallor/validering-2026-08-30.md
git commit -m "docs(skill): record hit-quality validation for bevaka-lokala-kallor"
```

---

### Task 7: Aktivera skrivning och cron

**Kör bara denna task om Task 6 gav go.**

**Files:**
- Modify: `.claude/skills/bevaka-lokala-kallor/SKILL.md`

**Interfaces:**
- Consumes: kärnans steg 6 med `grind: strikt`, `source_url` från Task 2.
- Produces: publicerade och gömda rader i `flea_markets`/`block_sales`; en veckovis cron.

- [ ] **Step 1: Enable writes in the skill**

I `.claude/skills/bevaka-lokala-kallor/SKILL.md`, ersätt hela avsnittet **## Läge** med:

```markdown
## Läge

**Skrivande.** Kör steg 2–6 i kärnan med `grind: strikt`. Kandidater som klarar
grinden publiceras direkt; övriga skrivs med `published_at = null` för granskning
i `/admin/markets`. Ingen dry-run-paus — säkerheten ligger i grinden.
```

Och i **Steg 4 — Rapportera**, byt kolumnrubriken `Grind` till `Utfall` och
värdena till `PUBLICERAD` / `GÖMD — <skäl>`.

- [ ] **Step 2: Verify the strict gate rejects a bad candidate**

Kör skillen mot en ort och plantera en känt dålig kandidat i flödet: en post med generiskt namn ("Second Hand") och en adress som bara löser på postnummer.

Expected: kandidaten skrivs med `published_at = null`, inte publicerad. Verifiera:

```sql
select name, city, published_at, source_url
from public.flea_markets
where source_url is not null
order by created_at desc limit 10;
```

Den dåliga kandidaten ska ha `published_at = null`.

- [ ] **Step 3: Verify a good candidate publishes with provenance**

I samma körning: en kandidat med specifikt namn, gatunivå-geokod och satt `source_url` ska ha `published_at` satt och `source_url` ifylld i frågan ovan.

- [ ] **Step 4: Verify the published row is visible on its hub**

```sql
select city, name from public.visible_flea_markets
where source_url is not null order by created_at desc limit 5;
```

Expected: raden syns i vyn. Besök `/loppisar/<ort>` och bekräfta att den listas.

- [ ] **Step 5: Create the weekly cron**

Använd `CronCreate` för en veckovis körning:
- Schema: måndagar 09:00
- Prompt: `Kör skillen bevaka-lokala-kallor. Rapportera publicerade, gömda och orter utan träff.`

- [ ] **Step 6: Create the monthly FB reminder**

Använd `CronCreate` för en månadsvis körning:
- Schema: första måndagen i månaden 09:00
- Prompt: `Beräkna ortprioriteringen enligt bevaka-lokala-kallor steg 1 och påminn mig om att köra FB-rundan (importera-loppisar) mot de 3 högst rankade orterna. Kör inte importen — jag måste öppna grupperna själv.`

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/bevaka-lokala-kallor/SKILL.md
git commit -m "feat(skill): enable strict-gate writes and weekly cron for bevaka-lokala-kallor"
```

---

## Vad planen medvetet inte gör

- **Takeover-funneln.** Inget utskick sedan 2026-05-21; 627 av 684 gömda loppisar aldrig kontaktade trots 40 % klickfrekvens på de 507 som gjordes. Sannolikt en större hävstång än den här agenten, men eget arbete och eget beslut.
- **Publicering av backloggen om 684.** De sitter i storstäder där auktoritetstaket ändå ger pos 10 och GBP äger klicket.
- **Flytt till CI.** Utvärderas när träffkvaliteten är bevisad.
- **Kö-tabell och ny admin-vy.** `/admin/markets` räcker för de gömda.
- **`sr-only`-nyckelordsstycket i `web/src/app/loppisar/[city]/page.tsx:299-303`.** Bör tas bort (Google diskonterar dold nyckelordstext), men hör inte till den här planen.
