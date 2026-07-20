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

### Steg 4 — Deduplicera mot databasen

För varje kandidat, matcha mot befintlig data via **fuzzy namn + ort** och
**geo-närhet (~150 m)**. Kör (byt ut värden per kandidat):

```sql
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
```

Märk varje kandidat:
- **NY** — ingen träff → skapas.
- **DUBBLETT** — finns redan publicerad → hoppa.
- **GÖMD-I-DB** — finns men `published_at` är null → **erbjud publicera i stället
  för att skapa dubblett** (vanligt: importbatchen skapade men publicerade aldrig).

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
inga)". Svara med ett urval och skriv "kör" för att bekräfta skrivningen.
Fortsätt till Steg 6 endast när användaren svarat med ett urval och "kör".

### Steg 6 — Skriv (endast efter explicit "kör" + urval)

**Permanent butik → `flea_markets`** (slug sätts av trigger; lat/long genereras
från `location` — sätt dem aldrig):

```sql
insert into flea_markets
  (name, organizer_id, is_permanent, is_system_owned, city, street, zip_code, region, country, category, description, contact_phone, location, published_at)
values
  ('<namn>','f1d57000-1000-4000-8000-000000000001',true,true,'<ort>','<gata>','<postnr>','<län>','Sverige','<kategori>','<beskrivning>','<telefon el. null>',
   st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, now())
returning name, slug, city;
```

**Veckotider** (om kända):

```sql
insert into opening_hour_rules (flea_market_id, type, day_of_week, open_time, close_time)
select id, 'weekly', <dow 0=sön..6=lör>, '<öppnar>', '<stänger>'
from flea_markets where slug = '<genererad slug>';
```

**Datumsatt event → `block_sales`** (slug sätts manuellt; lat/long genereras från
`center_location`):

```sql
insert into block_sales
  (organizer_id, name, slug, description, start_date, end_date, daily_open, daily_close, city, region, center_location, published_at)
values
  ('f1d57000-1000-4000-8000-000000000001','<namn>','<slug>','<beskrivning>','<start>','<slut>','<öppnar>','<stänger>','<ort>','<län>',
   st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, now())
returning name, slug, city, start_date;
```

**Publicera en GÖMD-I-DB-rad** (rätta felflaggad permanens så den blir synlig):

```sql
update flea_markets set published_at = now(), is_permanent = true
where id = '<id>' and is_deleted is not true and published_at is null
returning name, city;
```

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
