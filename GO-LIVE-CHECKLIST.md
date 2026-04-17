# Go-Live Checklista — Fyndstigen

Tre faser: Gratis-launch → Betalningar → Full launch (Skyltfönstret).
Varje fas aktiveras med env-variabler i wrangler.jsonc — ingen koddeploy.

---

## Fas 1: Gratis-launch (kan göras NU)

### 1.1 Supabase — databas
- [ ] **Kör alla migrations** i ordning (00001–00010) via SQL Editor
- [ ] **Verifiera extensions:** `pg_cron`, `pg_trgm`, `postgis` aktiverade
- [ ] **Deploy edge functions:**
```bash
npx supabase functions deploy booking-create
npx supabase functions deploy organizer-stats
```
- [ ] **Sätt PostHog secrets:**
```bash
supabase secrets set POSTHOG_PRIVATE_API_KEY=phx_...
supabase secrets set POSTHOG_PROJECT_ID=...
supabase secrets set POSTHOG_HOST=https://eu.i.posthog.com
```
- [ ] **Rate limiting:** Dashboard → Project Settings → API → 100 req/min per IP

### 1.2 Supabase Auth
- [ ] Dashboard → Authentication → URL Configuration
- [ ] Sätt **Site URL** till `https://fyndstigen.se`
- [ ] Lägg till `https://fyndstigen.se` i **Redirect URLs**
- [ ] Om Google Login: uppdatera OAuth-redirect i Google Cloud Console

### 1.3 Cloudflare — prod deploy
- [ ] Verifiera att `fyndstigen.se` DNS pekar till Cloudflare
- [ ] Verifiera `wrangler.jsonc` — **INGA** Stripe-vars (betalningar av)
- [ ] Bygg och deploya:
```bash
cd web && node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build
cd .. && node node_modules/wrangler/bin/wrangler.js deploy --config web/wrangler.jsonc --x-autoconfig=false
```
- [ ] Testa `https://fyndstigen.se` — HTTPS funkar
- [ ] Testa `https://www.fyndstigen.se` — redirect funkar

### 1.4 Testa gratis-flödet
- [ ] Skapa konto
- [ ] Skapa en loppis (alla bord 0 kr)
- [ ] Publicera
- [ ] Boka gratis bord som annan användare
- [ ] Sök, karta, loppisrunda
- [ ] Cookie-banner: acceptera → PostHog loggar
- [ ] Cookie-banner: neka → inga events
- [ ] Integritetspolicy-sida visas korrekt

### 1.5 SEO
- [ ] `https://fyndstigen.se/sitemap.xml` — loppisar + rundor listade
- [ ] `https://fyndstigen.se/robots.txt` — rätt regler
- [ ] Google Search Console → verifiera domän → skicka in sitemap
- [ ] Testa loppissida i [Rich Results Test](https://search.google.com/test/rich-results)

### 1.6 Monitoring
- [ ] Sentry — fel dyker upp
- [ ] PostHog — events loggas
- [ ] Supabase Logs — edge functions OK

### 1.7 Bjud in beta-testare
- [ ] Skriv kort instruktion
- [ ] Ha feedback-kanal (Discord/mejl)
- [ ] Övervaka Sentry + logs första dagarna

---

## Fas 2: Betalningar (kräver EF + Stripe Live)

### 2.1 Förutsättningar
- [ ] Enskild firma registrerad hos [Bolagsverket](https://bolagsverket.se) (1 200 kr, ~1 vecka)
- [ ] Org-nummer mottaget
- [ ] Uppdatera integritetspolicyn med firmanamn

### 2.2 Stripe Live Mode
- [ ] Stripe Dashboard → aktivera Live Mode (verifiering av identitet + bankkonto)
- [ ] Kopiera **live** publishable key (`pk_live_...`)
- [ ] Kopiera **live** secret key (`sk_live_...`)
- [ ] Skapa **live** webhook endpoint:
  - `account.updated`
  - `payment_intent.canceled`
  - `payment_intent.payment_failed`
  - `payment_intent.succeeded`
- [ ] Kopiera **live** webhook signing secret (`whsec_...`)
- [ ] Konfigurera Stripe Connect i Live Mode

### 2.3 Sätt secrets + deploy
```bash
# Supabase secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Deploy alla Stripe-relaterade edge functions
npx supabase functions deploy stripe-connect-create
npx supabase functions deploy stripe-connect-status
npx supabase functions deploy stripe-connect-refresh
npx supabase functions deploy stripe-payment-capture
npx supabase functions deploy stripe-payment-cancel
npx supabase functions deploy stripe-webhooks
```

### 2.4 Aktivera feature flag
Lägg till i `web/wrangler.jsonc` under `vars`:
```json
"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_..."
```

### 2.5 Deploya
```bash
cd web && node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build
cd .. && node node_modules/wrangler/bin/wrangler.js deploy --config web/wrangler.jsonc --x-autoconfig=false
```

### 2.6 Testa betalflödet
- [ ] Skapa loppis med betalda bord (t.ex. 200 kr)
- [ ] Koppla Stripe Connect som arrangör
- [ ] Boka bord → betala med riktigt kort
- [ ] Godkänn → verifiera capture i Stripe Dashboard
- [ ] Neka → verifiera att pengar släpps
- [ ] Gratis bord funkar fortfarande
- [ ] Stripe Dashboard → Webhooks → alla events 200

---

## Fas 3: Skyltfönstret (prenumeration)

### 3.1 Stripe — Skyltfönstret-produkt
- [ ] Skapa produkt "Skyltfönstret" i Stripe Live Mode
- [ ] Skapa pris: 69 SEK/mån (recurring)
- [ ] Kopiera Price ID (`price_...`)
- [ ] Lägg till webhook-events (om inte redan):
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Konfigurera Customer Portal (Settings → Billing → Customer portal)

### 3.2 Sätt secrets + deploy
```bash
supabase secrets set SKYLTFONSTRET_PRICE_ID=price_...

npx supabase functions deploy skyltfonstret-checkout
npx supabase functions deploy skyltfonstret-portal
npx supabase functions deploy stripe-webhooks  # uppdaterad med subscription events
```

### 3.3 Aktivera feature flag
Lägg till i `web/wrangler.jsonc` under `vars`:
```json
"NEXT_PUBLIC_SKYLTFONSTRET": "true"
```

### 3.4 Deploya
```bash
cd web && node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build
cd .. && node node_modules/wrangler/bin/wrangler.js deploy --config web/wrangler.jsonc --x-autoconfig=false
```

### 3.5 Testa Skyltfönstret
- [ ] Profil → "Uppgradera — 69 kr/mån" → Stripe Checkout → betala
- [ ] Verifiera `subscription_tier = 1` i DB
- [ ] Premium SEO: JSON-LD med öppettider, priser, breadcrumbs
- [ ] Premium stats: sidvisningar, konvertering, per-loppis
- [ ] Gratis-arrangör: ser låsta kort + upsell
- [ ] Avsluta via Customer Portal → verifiera nedgradering
- [ ] Stripe Webhooks → alla subscription events 200

---

## Feature flags — sammanfattning

| wrangler.jsonc vars | Resultat |
|---|---|
| *(inga Stripe-vars)* | Gratis-only: alla bord gratis, ingen betalning |
| + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Betalda bord, Stripe Connect, kommission |
| + `NEXT_PUBLIC_SKYLTFONSTRET=true` | Premium-tier, upgrade-knappar, gated stats/SEO |

Varje fas aktiveras genom att lägga till env-vars och köra `wrangler deploy`.
Ingen koddeploy behövs — bara config-ändring.

---

## Övrigt
- [ ] **Backups:** Överväg Supabase Pro ($25/mån) för Point-in-Time Recovery
- [ ] **Lokal Supabase:** `supabase start` för att testa migrations innan prod
