# Delad import-kärna: extrahera, berika, deduplicera, skriv

Källoberoende kärna som delas av `importera-loppisar` (FB, människa-i-loopen)
och `bevaka-lokala-kallor` (obemannad). Framsidan anropar denna kärna med:

- `grind: strikt | granskad` — styr publiceringsbeslutet (se **Kvalitetsgrind** nedan).
- `kandidater` — lista med rå text plus valfri `source_url` per kandidat.

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

**Normalisera orten före matchning.** Jämför alltid `lower(trim(city))`, aldrig
rå sträng. Två orter som skiljer sig på skiftläge är samma ort och delar
hubbsida — att skapa en ny rad med avvikande skiftläge splittrar hubben.

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

### Steg 6 — Skriv (endast efter explicit "kör" + urval)

**Permanent butik → `flea_markets`** (slug sätts av trigger; lat/long genereras
från `location` — sätt dem aldrig):

> **Tillåtna värden för `category`** (CHECK-constraint — inga andra godtas):
> `'Privat'`, `'Kyrklig-bistånd'`, `'Antik-retro'`, `'Kommunal'`, `'Kedja'`, `'Evenemang'`
>
> Vägledning: vanlig second hand/loppis (privat) → `Privat`; kyrklig eller biståndsdriven
> second hand (t.ex. Emmaus, Frälsningsarmén) → `Kyrklig-bistånd`; antik/retro/vintage →
> `Antik-retro`; kommunal (t.ex. återvinning eller kommunalt överskott) → `Kommunal`;
> kedja (Myrorna, Erikshjälpen, Röda Korset m.fl.) → `Kedja`; datumsatt mässa/marknad →
> `Evenemang`. `category` är nullable — använd `null` om osäker (hellre null än en gissad
> ogiltig kategori).

**Kräver migration `00064_source_url`.** Kolumnen `source_url` finns bara efter
att den migrationen körts. Är den inte på plats än: utelämna `source_url` ur
båda mallarna nedan i stället för att låta skrivningen fela.

```sql
insert into flea_markets
  (name, organizer_id, is_permanent, is_system_owned, city, street, zip_code, region, country, category, description, contact_phone, location, published_at, source_url)
values
  ('<namn>','f1d57000-1000-4000-8000-000000000001',true,true,'<ort>','<gata>','<postnr>','<län>','Sverige','<kategori>','<beskrivning>','<telefon el. null>',
   st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, now(), '<käll-url el. null>')
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
  (organizer_id, name, slug, description, start_date, end_date, daily_open, daily_close, city, region, center_location, published_at, source_url)
values
  ('f1d57000-1000-4000-8000-000000000001','<namn>','<slug>','<beskrivning>','<start>','<slut>','<öppnar>','<stänger>','<ort>','<län>',
   st_setsrid(st_makepoint(<lon>,<lat>),4326)::geography, now(), '<käll-url el. null>')
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
