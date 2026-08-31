# Validering 2026-08-31 — Fagersta & Forshaga

Körd i dry-run enligt Task 6 i `docs/superpowers/plans/2026-08-30-loppis-bevakningsagent.md`.
Inget skrevs till databasen.

| Ort | Kandidater | Klarade grinden | Manuellt korrekta | Falska positiva |
|---|---|---|---|---|
| Fagersta | 5 | 1 | 1 | 0 |
| Forshaga | 5 | 0 | 0 | 0 |
| **Totalt** | **10** | **1** | **1** | **0** |

**Precision** (korrekta / klarade grinden): 100 % — men på n = 1.
**Utbyte** (korrekta per ort): 0,5 — under tröskeln ≥ 1.

Enda publiceringsbara fyndet: En Hjälpande Hand, Dalavägen 55, 737 47 Fagersta.
Ideell förening, org.nr 802530-4802, husnummerträff i Nominatim, källa `fagersta.se`.
Verifierat att den inte redan finns i `flea_markets`.

## Vad som fungerade

Kvalitetsgrinden. Noll falska positiva av tio kandidater, och den stoppade rätt
saker av rätt skäl — inklusive två oberoende ortsfel i öppna källor:

- Visit Värmland serverar fem Årjängs-butiker under en `/forshaga/`-URL.
- Församlingskalendern i Forshaga listar en loppis som fysiskt ligger i Karlstad.

En agent som litat på URL-slug eller arrangörens hemort hade skapat sex
felplacerade rader. Grinden är alltså inte problemet.

## Vad som inte fungerade

Källorna.

- **Kommunala evenemangskalendrar innehåller inga loppisar.** Forshaga: 9 poster,
  noll loppis. Fagersta: ingen kalender (404).
- **Lokaltidningarna är stängda.** De är den enda källan till datumsatta loppisar:
  Fagersta-Posten och VF bakom betalvägg, ForshagaDejeNytt svarar 403 (WAF).
- **Fagersta-skörden var en engångsföreteelse.** Alla fem kandidater kom från en
  statisk kommunal shoppingsida. En veckovis bevakning av den ger noll nytt.
- **Den mest levande verksamheten finns bara på Facebook.** Forshaga loppis och
  kuriosa, Geijersgatan 2, öppet tis–tor + lör — per konstruktion oåtkomlig för
  den här skillen, och det är rätt att den är det.

## Beslut

**Den obemannade grenen läggs ned.** Utbytet 0,5 korrekta fynd per ort ligger
under planens tröskel, och regeln i Task 6 steg 4 är entydig: bär inte källorna,
lägg ned grenen och behåll den bemannade FB-rundan.

Behålls:

- **Task 1** — skiftlägesokänslig ortsammanslagning. Fixade en levande bugg som
  dolde loppisar på hubbsidor. Värdefull oavsett.
- **Task 2** — `source_url`-kolumnen. Härkomst är värd att spara även för
  manuellt inlagda rader.
- **Task 3 + 00066** — datastädningen (skiftläge, Öst-Tegs → Umeå,
  Åtivdaberg → Åtvidaberg).
- **Task 4** — den delade import-kärnan. Gör FB-rundan bättre oavsett, och
  kvalitetsgrinden visade sig fungera.
- **Stadsprioriteringen** — flyttas till `importera-loppisar`, som redan tar emot
  en valfri ortlista. Den är fortfarande rätt sätt att välja vad man ska leta
  efter; det var källorna som inte bar, inte prioriteringen.

Läggs ned:

- **Task 7** — skrivning och cron aktiveras inte.
- `bevaka-lokala-kallor` behålls som dokumentation av försöket men aktiveras inte.

## Om någon vill ta upp det här igen

Det som skulle ändra slutsatsen är en källa med **datumsatta** loppisar som är
öppen och uppdateras löpande. Betalväggarna på lokaltidningarna är den enskilt
största blockeraren — de har materialet, vi kommer inte åt det. En prenumeration
med tillåten maskinläsning, eller ett samarbete med en lokaltidning, vore ett
rimligt nytt försök.

Observation från körningen: båda orterna hade redan opublicerade loppisar i
databasen (Fagersta 1, Forshaga 2). Att publicera befintliga gömda rader gav mer
per insats än att leta nya — vilket pekar mot takeover-funneln, se
`docs/superpowers/specs/2026-08-30-loppis-bevakningsagent-design.md` under
Utanför scope.
