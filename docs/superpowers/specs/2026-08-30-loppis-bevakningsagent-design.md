# Loppis-bevakningsagent — kontinuerlig import från lokala källor — design

Datum: 2026-08-30
Status: godkänd design, ej implementerad
Bygger vidare på: `2026-07-20-importera-loppisar-design.md`

## Problem

Fyndstigen rankar pos 8–12 på alla loppis-queries med volym, och topp-5 bara där
konkurrensen är obefintlig. Mätt i GSC 2026-08-02–08-29:

| Visningar/28d | Query | Position |
|---|---|---|
| 24 | loppis kvissleby | 3,6 |
| 30 | loppis skoghall | 5,1 |
| 32 | loppis sjövik | 4,4 |
| 253 | loppis nora | 7,7 |
| 429 | loppis olofström | 11,8 |
| 831 | loppis karlskoga | 10,8 |
| 874 | loppis östersund | 8,4 |

Över ~250 visningar finns ingenting bättre än pos 8,4, oavsett stad eller
innehållsmängd. Sidmallen är redan komplett och identisk för alla städer, och
innehållsmängd korrelerar negativt (Skoghall rankar 5,1 med *en* loppis;
Östersund 8,4 med fyra). Taket är auktoritet på domännivå, inte on-page.

Slutsatsen: tillväxten ligger i **bredd över småorter med låg konkurrens**, inte
i att optimera befintliga sidor eller fylla på storstäderna.

Utbudet är samtidigt tunt nästan överallt — **250 av 305 städer har max 2
synliga loppisar**. Det finns alltså gott om mark att ta.

Dagens `importera-loppisar` levererar rätt sorts data men körs ad hoc, kräver att
en människa öppnar en FB-grupp, och har ingen stadsprioritering.

## Beslut (fastställda under brainstorm)

1. **Fynd publiceras direkt**, med kvalitetsgrind i stället för mänsklig
   granskning. Takeover erbjuds i efterhand på redan synliga sidor.
2. **Två källspår**: obemannat mot öppna källor + bemannat mot FB-grupper.
   FB-grupper får aldrig läsas obemannat (Facebooks villkor, kontorisk; deras
   API exponerar inte gruppinnehåll — det finns ingen laglig automatiseringsväg).
3. **Obemannad körning sker som Claude Code-cron lokalt**, inte i CI. Flytt till
   CI är en senare, separat fråga.
4. **Delad kärna, två tunna framsidor** — inte en skill med källparameter, så att
   ToS-spärren inte kan kringgås av misstag.

## Leverabel

Tre filer under `.claude/skills/`:

- `_loppis-import-karna.md` — delad, källoberoende pipeline (steg 2–6 + SQL).
- `importera-loppisar/SKILL.md` — bantad; behåller FB/Chrome-läsning, pekar på kärnan.
- `bevaka-lokala-kallor/SKILL.md` — ny; öppna källor, obemannad, cron-driven.

Plus en cron-post som kör `bevaka-lokala-kallor` veckovis och en glesare som
påminner om FB-rundan.

Samt en migration som lägger till härkomstkolumnen `source_url` (se
Schemaändring nedan).

## Schemaändring

`flea_markets` och `block_sales` får `source_url text null`.

Kolumnen är *inte* samma sak som befintliga `contact_website`, som är
verksamhetens egen webbplats. `source_url` är var vi hittade uppgiften — en
kommunkalender, en församlingssida, en föreningssajt. En rad kan ha båda, den ena
eller ingen.

Kolumnen krävs för att den strikta grinden ska gå att uppfylla och för att varje
automatiskt publicerad rad ska vara spårbar till sin källa. Rader skapade av
FB-rundan eller av människa lämnar den `null`.

## Arkitektur

```
                 cron (vecka)              cron (månad, påminnelse)
                      |                              |
          bevaka-lokala-kallor            importera-loppisar
        (WebSearch/WebFetch, obemannad)   (Claude-in-Chrome, bemannad)
                      \                         /
                       \                       /
                    _loppis-import-karna.md
        extrahera → klassificera → geokoda → dedupa → grind → skriv
                              |
                     flea_markets / block_sales
```

Kärnan äger allt som är svårt och farligt att ha i två kopior: dedup-SQL,
kategorilistan, slug-/geo-mekaniken, skrivmallarna. Framsidorna äger bara
*hur texten hämtas* och *vilken grind som gäller*.

### Komponent 1 — `_loppis-import-karna.md`

Flyttas ordagrant från dagens `importera-loppisar` steg 2–6, med två tillägg:

- **Ortnormalisering före dedup.** Jämför `lower(trim(city))`. Databasen har idag
  `Upplands väsby` och `Upplands Väsby` som två städer, alltså två konkurrerande
  hubbsidor för samma ort. Utan detta producerar agenten fler sådana.
- **Grind-nivå som indata.** Kärnan tar emot `grind: strikt | granskad` från
  framsidan och tillämpar reglerna i avsnittet Kvalitetsgrind nedan.

Oförändrat från dagens skill: kategori-CHECK-listan, system-organizer-id
`f1d57000-1000-4000-8000-000000000001`, `day_of_week` 0=sön…6=lör, förbudet mot
att röra `is_deleted=true`, och att `lat`/`long` är genererade och aldrig sätts.

### Komponent 2 — `importera-loppisar` (ändras)

Steg 2–6 ersätts av en hänvisning till kärnan med `grind: granskad`. Steg 1
(Chrome-läsningen) och hela säkerhetsavsnittet står kvar oförändrat. Dry-run och
det explicita "kör"-godkännandet behålls — den bemannade grenen publicerar
alltså fortfarande inte utan att du sagt till.

Nytt: skillen tar emot en valfri ortlista från prioriteringen, så FB-rundan kan
riktas mot de orter som behöver den mest.

### Komponent 3 — `bevaka-lokala-kallor` (ny)

Obemannad. Kör i fyra steg.

**3a. Välj orter.** Rangordna enligt avsnittet Stadsprioritering. Ta de 5–8
högsta som inte körts de senaste 30 dagarna.

**3b. Hitta källor per ort.** För varje ort, WebSearch efter mönstren:
`<ort> kommun evenemang`, `<ort> loppis`, `<ort> hembygdsförening`,
`<ort> församling second hand`, `<ort> byalag`, `<ort> loppmarknad <år>`.
Behåll träffar på domäner som ser ut som organisationer (kommun, församling,
förening, lokaltidning). Uteslut Facebook, Instagram, Blocket, Tradera och
aggregatorer som konkurrerar med oss.

**3c. Läs och extrahera.** WebFetch varje kandidatsida. Skicka innehållet genom
kärnans steg 2–4. Sätt `source_url` till sidan kandidaten lästes från — den är
obligatorisk för publicering (se grind).

**3d. Skriv och rapportera.** Kärnans steg 6 med `grind: strikt`. Rapportera
till användaren: publicerade, gömda med skäl, orter utan träff.

Ingen dry-run-paus — det är hela poängen med den obemannade grenen. Säkerheten
ligger i grinden, inte i en människa.

## Stadsprioritering

Poäng per ort: `visningar_28d / max(1, antal_synliga)`.

- **Datakälla:** GSC `get_search_analytics` med `dimensions=page`, filtrerat på
  `/loppisar/`-sidor, mot `visible_flea_markets` grupperat per stad.
- **Filter:** endast orter med `visningar < 250`. Över den tröskeln biter
  auktoritetstaket och mer innehåll ger bevisligen ingen positionsvinst.
- **Fallback:** orter med ≤2 synliga loppisar men utan GSC-data (ingen hubbsida
  har fått visningar) får baspoäng 10, alltså under alla orter med bevisad
  efterfrågan men över inget.
- **Kylning:** en ort som körts de senaste 30 dagarna hoppas över.

Toppen 2026-08-30:

| Stad | Visningar | Pos | Synliga | Poäng |
|---|---|---|---|---|
| Strömstad | 255 | 12,7 | 1 | 255 |
| Fagersta | 235 | 11,9 | 1 | 235 |
| Arlöv | 195 | 9,9 | 1 | 195 |
| Tomelilla | 156 | 11,5 | 1 | 156 |
| Forshaga | 138 | 9,8 | 1 | 138 |
| Gnesta | 138 | 11,2 | 1 | 138 |

Strömstad ligger marginellt över filtret på 250 men tas med — tröskeln är en
riktlinje, inte en hård gräns, och 255 visningar på en enda synlig loppis är den
största luckan under konkurrenströskeln.

Olofström (699 visningar, 1 synlig) är den enskilt största luckan totalt men
ligger klart över konkurrenströskeln. Den tas i FB-rundan i stället, där
träffkvaliteten är högre.

## Kvalitetsgrind

Två nivåer. `granskad` är dagens regler och gäller FB-rundan, där granska-tabellen
fångar felen. `strikt` gäller den obemannade grenen, där ingen människa ser
resultatet före publicering.

| Krav | granskad | strikt |
|---|---|---|
| Geokod löser på gatunivå | flagga om nej | **krav för publicering** |
| Källa sparad i `source_url` | — | **krav för publicering** |
| Specifikt namn (ej "Second Hand" utan gata) | flagga | **krav** |
| Identifierbar organisation bakom | — | **krav** |
| Osäker `is_permanent` | flagga | skriv gömd |
| Klarar inte kraven | flagga för beslut | **skriv gömd, publicera ej** |

Under `strikt` slängs aldrig en kandidat som misslyckas — den skrivs med
`published_at = null` och hamnar i `/admin/markets` för granskning. Det gör att
inget arbete går förlorat och att felen är inspekterbara i efterhand.

**Event får lösare grind än permanenta butiker.** Ett datumsatt `block_sales`
förfaller av sig självt och har ingen ägare som kan bli felrepresenterad; en
felaktig permanent butik ligger kvar och skadar både användare och den utpekade
verksamheten. Konkret: event får publiceras på postnummer-centroid, permanenta
butiker inte.

Oförändrat: rör aldrig `is_deleted=true`-rader.

## Kadens

- **Veckovis** — `bevaka-lokala-kallor` mot 5–8 orter. Rapport till användaren.
- **Månadsvis** — påminnelse att köra FB-rundan, med förslag på orter.

Cron körs lokalt via Claude Code och alltså bara när maskinen är igång. Det är
accepterat: missad körning skjuter bara upp, ingenting går sönder, och nästa
körning plockar upp samma orter eftersom kylningen är tidsbaserad.

## Testning / validering

1. **Regressionstest av FB-grenen.** Efter utbrytningen till kärnan: kör
   `importera-loppisar` mot en grupp som körts tidigare och verifiera att
   granska-tabellen blir densamma. Utbrytningen får inte ändra beteende.
2. **Dry-run av den nya grenen.** Kör `bevaka-lokala-kallor` mot två orter med
   `grind: strikt` men skrivsteget avstängt. Jämför kandidatlistan mot en manuell
   genomgång av samma orter. Mät hur många som klarar grinden och hur många av
   dem som faktiskt är korrekta.
3. **Grind-verifiering.** Mata in en känt dålig kandidat (saknad gatugeokod,
   generiskt namn) och verifiera att den skrivs gömd, inte publicerad.
4. **Dedup mot ortnormalisering.** Verifiera att en kandidat i "upplands väsby"
   matchar befintliga rader i "Upplands Väsby".

Först efter att steg 2 visat rimlig träffkvalitet aktiveras cron.

## Datafel att åtgärda (ingår)

- `Upplands väsby` / `Upplands Väsby` — slå ihop till en ort.
- `Öst-Tegs industriområde` som `city` — felparsad adress, ska vara Umeå.

Båda är engångsfixar i SQL, men ortnormaliseringen i kärnan hindrar återfall.

## Utanför scope (YAGNI)

- **Takeover-funneln.** Den har inte skickat något sedan 2026-05-21, och 627 av
  de 684 gömda loppisarna har aldrig kontaktats trots 40 % klickfrekvens på de
  507 utskick som gjordes. Det är sannolikt en större hävstång än den här agenten
  — men det är sitt eget arbete och buntas inte in här.
- Kö-tabell och ny admin-vy. `/admin/markets` räcker för de gömda.
- Flytt till CI. Utvärderas när träffkvaliteten är bevisad.
- Publicering av den befintliga backloggen om 684. De sitter i storstäder där
  auktoritetstaket ändå ger pos 10 och GBP äger klicket.

## Öppna risker

- **Träffkvalitet på öppna källor är obevisad.** Kommunkalendrar och
  föreningssidor är heterogen HTML och kan visa sig ge för få loppisar för att
  motivera körningarna. Steg 2 i valideringen är till för att avgöra det innan
  cron aktiveras. Om utfallet är svagt är rätt slutsats att lägga ned den
  obemannade grenen och behålla den bemannade FB-rundan med prioritering.
- **Publicering utan ägarens godkännande.** Vi publicerar uppgifter om
  verksamheter som inte bett om det. Grinden kräver därför en identifierbar
  organisation med sparad källa, så att varje publicerad rad är spårbar till
  varifrån uppgiften kom.
