# `/importera-loppisar` — semi-automatisk FB-grupp-import — design

**Date:** 2026-07-20
**Status:** Proposed (awaiting review)
**Branch:** `feat/importera-loppisar-skill`

## Problem

Facebook-grupper som "Loppisar i Örebro län" (13k+ medlemmar) är en rik källa
till loppisar — både permanenta second hand-/antikbutiker och datumsatta event
(gatuloppis, kvartersloppis). Idag samlas de in manuellt: läsa gruppen via
Claude-in-Chrome, extrahera, geokoda, deduplicera mot databasen, och skapa/
publicera. Loopen fungerar men körs helt för hand varje gång.

En **obemannad skrapa avfärdas medvetet**: Facebooks villkor förbjuder
automatiserad skrapning av grupper, privata grupper har inget läs-API (Groups
API dog 2020), och en bot som loggar in riskerar att kontot stängs. Lösningen
är en **halvautomatisk, människa-i-loopen-rutin** som codifierar den beprövade
manuella loopen — inte en autonom bot.

## Beslut (fastställda under brainstorm)

1. **Godkännandemodell: granska-tabell → publicera batch.** Rutinen visar en
   tabell med kandidater; användaren väljer vilka som ska in; de skrivs in
   publicerade. (Speglar den manuella loopen.)
2. **Omfattning: både permanenta butiker och datumsatta event.** Permanent →
   `flea_markets`; datumsatt → `block_sales`; ambigöst → flaggas.
3. **Dry-run är standard.** Första körningen (och default varje gång) stannar
   efter granska-tabellen — **inga DB-skrivningar** förrän användaren explicit
   säger "kör". Skrivning är ett medvetet andra steg, aldrig implicit.

## Leverabel

En **projekt-skill**: `.claude/skills/importera-loppisar/SKILL.md`, i linje med
befintliga `deploy-staging` / `run-tests` / `stripe-test`. Skillen är
*instruktioner* som agenten följer med MCP-verktyg (Claude-in-Chrome,
`mcp__supabase__execute_sql`, Nominatim via WebFetch). Inget fristående skript
loggar in på Facebook. Mekaniken (geokod, dedup, insert) återanvänder
`reference_market_data_ops` (minnesfil).

**Förutsättning:** användaren har FB-gruppen öppen i Chrome och
Claude-in-Chrome-tillägget är anslutet.

## Pipeline (6 steg)

### 1. Läs gruppen (Claude-in-Chrome, read-only)
- `tabs_context_mcp` → bekräfta den öppna gruppfliken (återanvänd, skapa inte ny).
- Skrolla diskussionsflödet och läs via **skärmdumpar** (FB krypterar DOM-texten
  → `get_page_text` är opålitlig; skärmdumpar renderar korrekt).
- Läs även **Evenemang**-fliken (+ klicka in på event för exakta datum, som
  Harge-fallet där "på fredag" dolde 10–11/7, 22/7, 24–25/7).
- **Djup:** valbart; default = senaste flödet (~30 dagar / N skrollningar).
- **Read-only:** inga gilla, kommentarer, inlägg, medlemsansökningar. Rör inga
  Messenger-popups eller privat innehåll.

### 2. Extrahera & klassificera
- Strukturera varje relevant inlägg/event: `name`, rå adresstext, datum/tider,
  öppettider, kontakt (telefon/webb).
- Klassa: **PERMANENT** (stående butik), **EVENT** (datumsatt), **AMBIGUÖST**.
- Släng icke-loppis-inlägg: frågor ("vilka har öppet på tisdag?"), efterlysningar,
  rena bild-inlägg utan butik/plats.

### 3. Berika
- **Geokoda** via Nominatim: `…/search?format=json&q=<adress>`; fallback till
  `postalcode`-centroid om husnr inte löser. Märk träffsäkerhet:
  `gata` / `postnr` / `misslyckad`.
- **Permanent:** tolka veckotider → `opening_hour_rules` (`type='weekly'`,
  **dow 0=sön … 6=lör**).
- **Event:** `start_date`/`end_date` + `daily_open`/`daily_close`.

### 4. Deduplicera (mot befintlig data)
- Matcha mot `flea_markets` / `block_sales` på **fuzzy namn + ort** och
  **geo-närhet (~150 m)**.
- Märk varje kandidat:
  - **NY** — skapas.
  - **DUBBLETT** — finns redan publicerad → hoppa.
  - **GÖMD-I-DB** — finns men opublicerad (`published_at` null) → **erbjud
    publicera istället för att skapa dubblett** (återkommande högvärdesmönster).

### 5. Granska-tabell (dry-run-stopp)
Presentera kandidater grupperat:

| # | Namn | Ort | Adress | Geo | Typ | Status |
|---|------|-----|--------|-----|-----|--------|
| 1 | Åströms Antik | Kumla | Holmagatan 63 | gata ✅ | perm | NY |
| 2 | Navet | Kumla | Stenevägen 43 | — | perm | DUBBLETT |
| 3 | Gåvan Secondhand | Nora | Brunnsgatan 20 | gata ✅ | perm | GÖMD → publicera |
| … |

Sektioner: **NYA** (skapas), **DUBBLETTER** (hoppas), **GÖMDA** (publiceras
istället), **AMBIGUÖSA/LÅGKVALITET** (kräver användarens beslut).
**Här stannar dry-run.** Ingen skrivning förrän användaren säger "kör" och
anger urval (alla / `1,2,4` / inga).

### 6. Skriv (endast efter explicit "kör")
- **Permanent:** `INSERT` i `flea_markets` — `organizer_id` = system
  `f1d57000-1000-4000-8000-000000000001`, `is_system_owned=true`,
  `is_permanent=true`, `location = st_setsrid(st_makepoint(lon,lat),4326)::geography`
  (lat/long är genererade — sätt aldrig direkt), slug via insert-trigger,
  `published_at = now()`. Ev. `opening_hour_rules`.
- **Event:** `INSERT` i `block_sales` — samma organizer, `slug` sätts **manuellt**
  (ingen slug-trigger på block_sales), `center_location` (lat/long genererade),
  `published_at = now()`.
- **Gömda:** `UPDATE … SET published_at = now(), is_permanent = true` (rätta
  felflaggad permanens så butiken blir synlig — `is_market_visible` kräver
  `is_permanent` ELLER framtida datumregel).
- Rapportera skrivet + ev. uppföljning (saknade tider, grova koordinater).

## Kvalitetsgrind (defaults)

- Hoppa/flagga kandidater utan geokodbar adress ("PM för adress"), generiska
  namn ("Second Hand" utan gata), eller frågeinlägg.
- **Rör aldrig `is_deleted`-rader** — respektera medvetna borttagningar.
- Geokod-miss → flagga, skapa aldrig med gissad/fel koordinat.
- Osäker permanens → flagga hellre än gissa.

## Säkerhet & FB-villkor (skrivs in i skillen)

- Läser bara en grupp användaren redan har öppen; ingen obemannad automatisering,
  ingen inloggning på användarens vägnar, ingen skrapning bortom den öppna
  sessionen → inom ToS, ingen konto-risk.
- Inga FB-skrivningar (gilla/inlägg/ansökningar).
- Alla DB-skrivningar förhandsvisas i granska-tabellen; dry-run är standard.
- Idempotent i praktiken: dedup hindrar återinsättning vid omkörning.

## Utanför scope (YAGNI)

- Obemannad eller schemalagd skrapning.
- Extrahera 200+ kartnålar ur event-kartor (Bergslagens loppishelg) — bilder,
  inte text.
- Auto-publicering utan granska-steget.
- En generell "publicera alla gömda DB-rader"-svep (separat rutin).
- Bygga en Nominatim-wrapper/skript — geokodning sker inline via WebFetch.

## Testning / validering

En skill är instruktioner, inte kod. Validering = **dry-run på en riktig grupp**
(steg 1–5, inga skrivningar) och jämför tabellen mot vad som faktiskt finns.
Själva skriv-mekaniken är redan bevisad från de manuella körningarna 2026-07
(Örebro/Katrineholm/Nora/Kumla/Fellingsbro/Laxå m.fl.) och dokumenterad i
`reference_market_data_ops`.

## Öppna punkter (icke-blockerande, defaults valda)

- **Skanningsdjup** default "senaste flödet"; kan höjas per körning.
- **Läns-/ortsfilter** valfritt argument om man bara vill ha ett visst område.
