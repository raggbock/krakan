---
name: bevaka-lokala-kallor
description: Leta upp loppisar och kvartersloppisar i prioriterade småorter via öppna lokala källor (kommunkalendrar, församlingar, hembygdsföreningar) och identifiera dem via den delade kärnan. Obemannad — läser aldrig Facebook.
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

Hämta utbudet — bygg samma slug i SQL i stället för att jämföra mot rå `city`,
via `public.slugify_city(text)`. Det är samma funktion appens routing
använder för att slå upp `/loppisar/<slug>`, så join-nyckeln kan inte driva
isär från källan:

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
