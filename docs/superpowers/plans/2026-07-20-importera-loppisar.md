# /importera-loppisar Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author a project skill (`.claude/skills/importera-loppisar/SKILL.md`) that codifies the semi-automatic Facebook-group loppis-import loop, with dry-run by default and DB writes only on explicit go.

**Architecture:** The deliverable is a single procedural `SKILL.md` — instructions the agent follows using existing MCP tools (Claude-in-Chrome, `mcp__supabase__execute_sql`, Nominatim via WebFetch). No standalone runnable code. "Tests" are safe recipe validations: the geocode URL and dedup SQL run read-only; insert templates validate via `EXPLAIN` (plans, never persists). The write mechanics are already proven live this session and recorded in the `reference_market_data_ops` memory.

**Tech Stack:** Markdown skill file (YAML frontmatter + body); PostgreSQL/PostGIS (Supabase); Nominatim (OpenStreetMap) geocoding; Claude-in-Chrome MCP.

## Global Constraints

- Skill lives at `.claude/skills/importera-loppisar/SKILL.md`, matching existing skills (`deploy-staging`, `run-tests`, `stripe-test`): YAML frontmatter (`name`, `description`) + markdown body.
- `disable-model-invocation: true` — this skill drives a browser and writes to prod; it runs only on explicit invocation, never auto-triggered.
- **Dry-run is the default.** The procedure stops after the review table (step 5); DB writes (step 6) happen only after the user explicitly says "kör" and selects rows.
- Read-only on Facebook: no likes/comments/posts/join requests; only reads a group the user already has open. No unattended scraping, no login-on-behalf.
- DB write mechanics (verbatim, from `reference_market_data_ops`):
  - System organizer id: `f1d57000-1000-4000-8000-000000000001`; new rows `is_system_owned = true`.
  - `flea_markets`: `latitude`/`longitude` are GENERATED from `location` — never insert them; set `location = st_setsrid(st_makepoint(lon,lat),4326)::geography`. `slug` auto-set by BEFORE INSERT trigger — do not provide.
  - `block_sales`: **no slug trigger** — provide `slug`; `latitude`/`longitude` GENERATED from `center_location`.
  - `opening_hour_rules`: `type='weekly'`, `day_of_week` 0=Sunday … 6=Saturday.
  - Visibility: a market shows only if `published_at` set AND not deleted AND (`is_permanent=true` OR a future dated rule). Fix mis-flagged permanence with `is_permanent=true`.
  - Never touch `is_deleted=true` rows.
- Geocoding: Nominatim `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<addr>`; fallback `&postalcode=<code>&country=Sweden` for rural misses; tag confidence gata/postnr/misslyckad.
- All commands that reference the DB use the Supabase MCP (`mcp__supabase__execute_sql`); project is Supabase project the session is connected to.

---

### Task 1: Scaffold the skill — frontmatter, safety boundaries, preconditions, read-group section

**Files:**
- Create: `.claude/skills/importera-loppisar/SKILL.md`

**Interfaces:**
- Produces: the skill file with frontmatter (`name: importera-loppisar`), the Safety/ToS section, Preconditions, and pipeline **Step 1 (Read the group)**. Later tasks append Steps 2–6 and the quality gate.

- [ ] **Step 1: Create the skill file with frontmatter + safety + preconditions + read section**

Create `.claude/skills/importera-loppisar/SKILL.md`:

```markdown
---
name: importera-loppisar
description: Semi-automatiskt importera loppisar från en Facebook-grupp användaren har öppen i Chrome. Läs via Claude-in-Chrome, klassa permanenta butiker vs datumsatta event, geokoda, deduplicera mot databasen, visa en granska-tabell, och skriv in (endast efter explicit "kör"). Dry-run som standard.
disable-model-invocation: true
---

# Importera loppisar från en Facebook-grupp

Halvautomatisk, människa-i-loopen-rutin. Läser en FB-grupp du redan har öppen,
extraherar loppisar, geokodar + dedupar mot databasen, och visar en granska-tabell.
**Inget skrivs till databasen förrän du explicit säger "kör".**

## Säkerhet & Facebooks villkor (läs först)

- **Read-only på Facebook.** Inga gilla, kommentarer, inlägg eller
  medlemsansökningar. Rör inte Messenger-popups eller annat privat innehåll.
- **Bara en grupp du redan har öppen.** Ingen inloggning på din vägnar, ingen
  obemannad skrapning, inget utöver den öppna sessionen. Det håller oss inom
  Facebooks villkor och utan konto-risk.
- **Dry-run är standard.** Rutinen stannar efter granska-tabellen. DB-skrivning
  sker bara efter att du säger "kör" och väljer vilka rader.

## Förutsättningar

- FB-gruppen är öppen i en Chrome-flik.
- Claude-in-Chrome-tillägget är anslutet (`tabs_context_mcp` svarar). Om inte:
  be användaren aktivera tillägget (claude.ai/chrome) och starta om Chrome.
- Supabase-MCP och WebFetch är tillgängliga.

## Pipeline

### Steg 1 — Läs gruppen (Claude-in-Chrome, read-only)

1. `tabs_context_mcp` → hitta den öppna gruppfliken. **Återanvänd den** — skapa
   ingen ny flik.
2. Skrolla diskussionsflödet och läs via **skärmdumpar** (`computer` med
   `action: screenshot` / `scroll`). Facebook krypterar DOM-texten, så
   `get_page_text` är opålitlig — skärmdumpar renderar korrekt.
3. Läs även **Evenemang**-fliken (`/events`). Klicka in på event för exakta
   datum — rel­ativa "på fredag" döljer ofta flera datum (t.ex. Harge: 10–11/7,
   22/7, 24–25/7).
4. **Djup:** default = senaste flödet (~30 dagar / ~6–8 skrollningar). Kan höjas
   om användaren ber om det.
```

- [ ] **Step 2: Verify the frontmatter parses and the file is discoverable**

Run: `head -5 .claude/skills/importera-loppisar/SKILL.md`
Expected: shows the `---` frontmatter with `name: importera-loppisar` and `disable-model-invocation: true`.

Run: `ls .claude/skills/importera-loppisar/SKILL.md`
Expected: file exists (no error).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/importera-loppisar/SKILL.md
git commit -m "feat(skill): scaffold importera-loppisar (frontmatter, safety, read step)"
```

---

### Task 2: Extract/classify/enrich section — with a validated geocode recipe

**Files:**
- Modify: `.claude/skills/importera-loppisar/SKILL.md` (append Steps 2–3)

**Interfaces:**
- Consumes: the file from Task 1.
- Produces: pipeline **Step 2 (Extract & classify)** and **Step 3 (Enrich: geocode + hours)**, including the verified Nominatim URL pattern.

- [ ] **Step 1: Validate the geocode recipe against a known address**

Use WebFetch on:
`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Holmagatan%2063%20Kumla%20Sweden`
Prompt: "Return the lat and lon from the first JSON result."
Expected: returns approximately `lat 59.10`, `lon 15.23` (Holmagatan, Kumla). This confirms the URL pattern works before documenting it.

- [ ] **Step 2: Validate the rural postalcode fallback**

Use WebFetch on:
`https://nominatim.openstreetmap.org/search?format=json&limit=1&country=Sweden&postalcode=695%2091`
Prompt: "Return the lat and lon from the first JSON result."
Expected: returns approximately `lat 58.98`, `lon 14.67` (695 91, Laxå kommun). Confirms the fallback for rural addresses that fail house-number lookup.

- [ ] **Step 3: Append the extract + enrich sections using the verified recipe**

Append to `.claude/skills/importera-loppisar/SKILL.md`:

```markdown
### Steg 2 — Extrahera & klassificera

För varje relevant inlägg/event, strukturera:
`name`, rå adresstext, datum/tider, öppettider, kontakt (telefon/webb).

Klassa varje kandidat:
- **PERMANENT** — stående butik (second hand, antik, gårdsbutik) → `flea_markets`.
- **EVENT** — datumsatt (gatuloppis, kvartersloppis) → `block_sales`.
- **AMBIGUÖST** — oklart → flagga för användaren, gissa inte.

Släng icke-loppis-inlägg: frågor ("vilka har öppet på tisdag?"), efterlysningar,
rena bildinlägg utan butik/plats.

### Steg 3 — Berika

**Geokoda** adressen via Nominatim (OpenStreetMap):
`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<adress> Sweden`
(WebFetch, be om lat/lon från första träffen). Om husnummer inte löser (vanligt
för rurala adresser), fallback:
`https://nominatim.openstreetmap.org/search?format=json&limit=1&country=Sweden&postalcode=<postnr>`
Märk träffsäkerhet: **gata** (husnr/gata löste), **postnr** (bara postnummer-
centroid — grov), **misslyckad** (ingen träff → flagga, skapa inte).

**Öppettider:**
- Permanent → `opening_hour_rules`: `type='weekly'`, `day_of_week` **0=sön,
  1=mån … 6=lör**, `open_time`/`close_time`.
- Event → `start_date`/`end_date` + `daily_open`/`daily_close`.
```

- [ ] **Step 4: Verify the dow convention is stated correctly**

Run: `grep -n "0=sön" .claude/skills/importera-loppisar/SKILL.md`
Expected: one match — confirms the `day_of_week` mapping is documented (0=Sunday), matching the DB.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/importera-loppisar/SKILL.md
git commit -m "feat(skill): extract/classify + verified geocode recipe"
```

---

### Task 3: Dedup section — with a validated dedup query

**Files:**
- Modify: `.claude/skills/importera-loppisar/SKILL.md` (append Step 4)

**Interfaces:**
- Consumes: the file from Task 2.
- Produces: pipeline **Step 4 (Deduplicate)**, including the exact SQL used to classify a candidate as NY / DUBBLETT / GÖMD-I-DB.

- [ ] **Step 1: Validate the dedup query against a known existing market**

Run via `mcp__supabase__execute_sql`:

```sql
select name, city, published_at is not null as published, is_deleted
from flea_markets
where is_deleted is not true
  and city ilike 'Kumla'
  and name ilike '%navet%'
order by name;
```

Expected: returns "Navet (Biståndsföreningen)" (Kumla, published=true) — the proven existing-shop case. Confirms the name+city match approach classifies a real duplicate.

- [ ] **Step 2: Validate the "hidden in DB" detection**

Run via `mcp__supabase__execute_sql`:

```sql
select count(*) as hidden_complete_candidates
from flea_markets
where region ilike 'Örebro%'
  and published_at is null
  and is_deleted is not true
  and location is not null
  and street is not null;
```

Expected: returns a small non-negative count (0 is acceptable if all were published earlier this session). Confirms the "GÖMD-I-DB" query shape runs without error.

- [ ] **Step 3: Append the dedup section**

Append to `.claude/skills/importera-loppisar/SKILL.md`:

```markdown
### Steg 4 — Deduplicera mot databasen

För varje kandidat, matcha mot befintlig data via **fuzzy namn + ort** och
**geo-närhet (~150 m)**. Kör (byt ut värden per kandidat):

\`\`\`sql
-- Existerande/gömd match på namn+ort:
select id, name, city, published_at is not null as published, is_deleted, is_permanent
from flea_markets
where is_deleted is not true
  and city ilike '<ort>'
  and name ilike '%<namnkärna>%';

-- Geo-närhet (~150 m) som komplement när namn skiljer sig:
select id, name, city
from flea_markets
where is_deleted is not true
  and location is not null
  and st_dwithin(location, st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, 150);
\`\`\`

Märk varje kandidat:
- **NY** — ingen träff → skapas.
- **DUBBLETT** — finns redan publicerad → hoppa.
- **GÖMD-I-DB** — finns men `published_at` är null → **erbjud publicera i stället
  för att skapa dubblett** (vanligt: importbatchen skapade men publicerade aldrig).
```

- [ ] **Step 4: Verify the geo-proximity function name is correct**

Run: `grep -n "st_dwithin" .claude/skills/importera-loppisar/SKILL.md`
Expected: one match — confirms the PostGIS proximity function is documented.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/importera-loppisar/SKILL.md
git commit -m "feat(skill): dedup step with validated name/geo queries"
```

---

### Task 4: Review-table + write section — with EXPLAIN-validated insert templates

**Files:**
- Modify: `.claude/skills/importera-loppisar/SKILL.md` (append Steps 5–6)

**Interfaces:**
- Consumes: the file from Task 3.
- Produces: pipeline **Step 5 (Review table / dry-run stop)** and **Step 6 (Write, only on "kör")**, with the exact `flea_markets` / `block_sales` / `opening_hour_rules` insert templates and the publish-hidden update.

- [ ] **Step 1: Validate the flea_markets insert template with EXPLAIN (plans, never persists)**

Run via `mcp__supabase__execute_sql`:

```sql
explain insert into flea_markets
  (name, organizer_id, is_permanent, is_system_owned, city, street, zip_code, region, country, category, description, contact_phone, location, published_at)
values
  ('__probe__','f1d57000-1000-4000-8000-000000000001',true,true,'Kumla','X 1','000 00','Örebro län','Sverige','Privat','d',null,
   st_setsrid(st_makepoint(15.0,59.0),4326)::geography, now());
```

Expected: returns a query plan with NO error. Crucially it must NOT error with "cannot insert a non-DEFAULT value into column latitude" (that error only appears if latitude/longitude are wrongly included). This confirms the column list is correct (location only; lat/long omitted; slug omitted for the trigger). Nothing is written — EXPLAIN plans only.

- [ ] **Step 2: Validate the block_sales insert template with EXPLAIN**

Run via `mcp__supabase__execute_sql`:

```sql
explain insert into block_sales
  (organizer_id, name, slug, description, start_date, end_date, daily_open, daily_close, city, region, center_location, published_at)
values
  ('f1d57000-1000-4000-8000-000000000001','__probe__','__probe__','d','2026-08-01','2026-08-01','10:00','15:00','Kumla','Örebro län',
   st_setsrid(st_makepoint(15.0,59.0),4326)::geography, now());
```

Expected: query plan, NO error. Confirms `slug` is provided (no trigger), `center_location` set, lat/long omitted (generated).

- [ ] **Step 3: Validate the opening_hour_rules + publish-hidden templates with EXPLAIN**

Run via `mcp__supabase__execute_sql`:

```sql
explain insert into opening_hour_rules (flea_market_id, type, day_of_week, open_time, close_time)
  values ('00000000-0000-0000-0000-000000000000','weekly',6,'10:00','15:00');
```

Expected: query plan, NO error (confirms column names/types).

Then run:

```sql
explain update flea_markets set published_at = now(), is_permanent = true
where city ilike 'Kumla' and is_deleted is not true and published_at is null and name = '__probe__';
```

Expected: query plan, NO error (confirms the publish-hidden update shape).

- [ ] **Step 4: Append the review-table + write sections**

Append to `.claude/skills/importera-loppisar/SKILL.md`:

```markdown
### Steg 5 — Granska-tabell (dry-run stannar här)

Presentera kandidaterna grupperat. Föreslagen tabell:

| # | Namn | Ort | Adress | Geo | Typ | Status |
|---|------|-----|--------|-----|-----|--------|
| 1 | Åströms Antik | Kumla | Holmagatan 63 | gata ✅ | perm | NY |
| 2 | Navet | Kumla | Stenevägen 43 | — | perm | DUBBLETT |
| 3 | Gåvan Secondhand | Nora | Brunnsgatan 20 | gata ✅ | perm | GÖMD → publicera |

Sektioner: **NYA** (skapas), **DUBBLETTER** (hoppas), **GÖMDA** (publiceras i
stället), **AMBIGUÖSA/LÅGKVALITET** (kräver ditt beslut).

**Här stannar dry-run.** Skriv inget. Fråga: "Vilka ska in? (alla / t.ex. 1,3 /
inga)". Fortsätt till Steg 6 endast när användaren svarat med ett urval.

### Steg 6 — Skriv (endast efter explicit "kör" + urval)

**Permanent butik → `flea_markets`** (slug sätts av trigger; lat/long genereras
från `location` — sätt dem aldrig):

\`\`\`sql
insert into flea_markets
  (name, organizer_id, is_permanent, is_system_owned, city, street, zip_code, region, country, category, description, contact_phone, location, published_at)
values
  ('<namn>','f1d57000-1000-4000-8000-000000000001',true,true,'<ort>','<gata>','<postnr>','<län>','Sverige','<kategori>','<beskrivning>','<telefon el. null>',
   st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, now())
returning name, slug, city;
\`\`\`

**Veckotider** (om kända):

\`\`\`sql
insert into opening_hour_rules (flea_market_id, type, day_of_week, open_time, close_time)
select id, 'weekly', <dow 0=sön..6=lör>, '<öppnar>', '<stänger>'
from flea_markets where slug = '<genererad slug>';
\`\`\`

**Datumsatt event → `block_sales`** (slug sätts manuellt; lat/long genereras från
`center_location`):

\`\`\`sql
insert into block_sales
  (organizer_id, name, slug, description, start_date, end_date, daily_open, daily_close, city, region, center_location, published_at)
values
  ('f1d57000-1000-4000-8000-000000000001','<namn>','<slug>','<beskrivning>','<start>','<slut>','<öppnar>','<stänger>','<ort>','<län>',
   st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, now())
returning name, slug, city, start_date;
\`\`\`

**Publicera en GÖMD-I-DB-rad** (rätta felflaggad permanens så den blir synlig):

\`\`\`sql
update flea_markets set published_at = now(), is_permanent = true
where id = '<id>' and is_deleted is not true and published_at is null
returning name, city;
\`\`\`

Efter skrivning: rapportera vad som skapades/publicerades + ev. uppföljning
(saknade tider, grova koordinater, ambigösa som du bör titta på). Verifiera att
raderna syns via `visible_flea_markets` / kommande `block_sales`.

## Kvalitetsgrind (defaults)

- Hoppa/flagga kandidater utan geokodbar adress ("PM för adress"), generiska
  namn ("Second Hand" utan gata), eller frågeinlägg.
- **Rör aldrig `is_deleted=true`-rader** — respektera medvetna borttagningar.
- Geokod-miss → flagga, skapa aldrig med gissad koordinat.
- Osäker permanens → flagga hellre än gissa (fel `is_permanent` döljer butiken).

## Mekanik-referens

Se minnesfilen `reference_market_data_ops` för synlighetsregeln, system-organizern,
genererade kolumner, slug-trigger och geokodning.
```

- [ ] **Step 5: Verify no accidental real insert ran and the write templates are present**

Run: `grep -c "insert into flea_markets" .claude/skills/importera-loppisar/SKILL.md`
Expected: at least 1 (the template is documented).

Run via `mcp__supabase__execute_sql`:

```sql
select count(*) as probe_rows from flea_markets where name = '__probe__';
```

Expected: `0` — confirms the EXPLAIN validations never persisted a probe row.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/importera-loppisar/SKILL.md
git commit -m "feat(skill): review-table + write templates (EXPLAIN-validated)"
```

---

### Task 5: Final read-through and spec-coverage review

**Files:**
- Modify: `.claude/skills/importera-loppisar/SKILL.md` (only if the review finds gaps)

**Interfaces:**
- Consumes: the complete file from Task 4.
- Produces: a verified, self-consistent skill covering every spec section.

- [ ] **Step 1: Check every spec requirement is present in the skill**

Run these greps; each must return at least one match:

```bash
grep -c "Dry-run" .claude/skills/importera-loppisar/SKILL.md      # dry-run default
grep -c "read-only\|Read-only" .claude/skills/importera-loppisar/SKILL.md  # FB safety
grep -c "PERMANENT" .claude/skills/importera-loppisar/SKILL.md    # classification
grep -c "block_sales" .claude/skills/importera-loppisar/SKILL.md  # events path
grep -c "GÖMD" .claude/skills/importera-loppisar/SKILL.md         # hidden-in-DB dedup
grep -c "is_deleted" .claude/skills/importera-loppisar/SKILL.md   # never touch deleted
grep -c "f1d57000-1000-4000-8000-000000000001" .claude/skills/importera-loppisar/SKILL.md  # system organizer
```

Expected: every command returns ≥1. If any returns 0, add the missing content and re-run.

- [ ] **Step 2: Read the whole skill top-to-bottom for flow and contradictions**

Read `.claude/skills/importera-loppisar/SKILL.md` end to end. Confirm: the 6 steps are in order; the dry-run stop is unambiguous (step 5 stops, step 6 gated on "kör"); no section contradicts another; all SQL uses the system organizer and the generated-column rules. Fix any issue inline.

- [ ] **Step 3: Final commit (only if Step 2 changed anything)**

```bash
git add .claude/skills/importera-loppisar/SKILL.md
git commit -m "docs(skill): final review pass for importera-loppisar"
```

---

## Notes for the implementer

- The deliverable is documentation, but the EXPLAIN and read-only SQL validations are load-bearing: they catch a wrong column, a generated-column mistake, or a missing slug before the skill is ever run live. Do not skip them.
- Every `explain …` statement plans without executing — it must NOT persist rows. Task 4 Step 5 re-confirms zero `__probe__` rows exist.
- Do not run the bare (non-EXPLAIN) insert templates during implementation — those are for the live skill, gated behind the user's "kör".
- The write mechanics mirror what was proven live in the 2026-07 manual imports; the skill just codifies them.
