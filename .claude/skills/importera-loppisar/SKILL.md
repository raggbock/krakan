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
