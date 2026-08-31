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
- `mcp__supabase__execute_sql` måste köra med skrivrättigheter (service/privilegierad
  roll) — `flea_markets` och `block_sales` har RLS som blockerar INSERT för
  icke-ägarroller. Läsningar (Steg 4) fungerar ändå, men skrivningen i Steg 6 nekas
  utan rätt roll.

## Steg 0 — Välj orter att leta efter (valfritt men rekommenderat)

Hoppa över det här om du redan vet vilken grupp och vilka orter du är ute efter.
Annars: räkna fram var en runda ger mest, och prioritera inlägg och event som rör
de orterna när du läser gruppen.

Poäng per ort: `visningar_28d / max(1, antal_synliga)` — efterfrågan delat med
utbud.

Hämta efterfrågan via GSC-MCP:
`get_search_analytics(site_url='sc-domain:fyndstigen.se', days=28, dimensions='page', row_limit=200)`
och behåll sidor under `/loppisar/`. Sluggen efter `/loppisar/` är orten.

Hämta utbudet — bygg samma slug i SQL i stället för att jämföra mot rå `city`,
via `public.slugify_city(text)`. Det är samma funktion appens routing använder
för att slå upp `/loppisar/<slug>`, så join-nyckeln kan inte driva isär från
källan:

```sql
select
  public.slugify_city(city) as slug,
  min(city) as visningsnamn,
  count(*) as synliga
from public.visible_flea_markets
group by 1
order by 1;
```

Matcha alltid på `slug` mot `slug` — GSC-sökvägens segment efter `/loppisar/` på
ena sidan och kolumnen `slug` ovan på den andra. Jämför **aldrig** rå `city`
direkt mot en GSC-slug; `city` innehåller mellanslag, versaler och svenska
tecken (å/ä/ö osv.) som GSC-sluggen redan har normaliserat bort, så en bokstavlig
jämförelse missar flerordsorter och orter med diakritiska tecken helt.
`visningsnamn` är bara till för rapporttabellen — identiteten är slugen.

Regler:
- Endast orter med **visningar < 250**. Över den tröskeln biter auktoritetstaket
  och mer innehåll ger bevisligen ingen positionsvinst. (Riktlinje, inte hård
  gräns — en ort strax över med bara 1 synlig loppis får tas med.)
- Orter med ≤2 synliga men utan GSC-data får baspoäng **10**.
- Ta de **5–8** högsta.

Ortlistan kan också komma utifrån i anropet. Ignorera listan om gruppen du har
öppen inte täcker de orterna — den styr vad du letar efter, inte vilken grupp du
läser.

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

### Steg 2–6 — delad kärna

Följ `.claude/skills/_loppis-import-karna.md` med `grind: granskad`.

Dry-run gäller fortfarande: kärnan stannar vid granska-tabellen och skriver
ingenting förrän du svarat med ett urval och "kör".

## Mekanik-referens

Se minnesfilen `reference_market_data_ops` för synlighetsregeln, system-organizern,
genererade kolumner, slug-trigger och geokodning.
