# Go-Live Checklista — Fyndstigen

## 1. Enskild firma
- [ ] Registrera enskild firma hos [Bolagsverket](https://bolagsverket.se) (1 200 kr)
- [ ] Invänta org-nummer (~1 vecka)
- [ ] Uppdatera `web/src/app/integritetspolicy/page.tsx` med firmanamn

## 2. Stripe — byt till Live Mode
- [ ] Stripe Dashboard → aktivera Live Mode (kräver verifiering av identitet + bankkonto)
- [ ] Kopiera **live** publishable key (`pk_live_...`)
- [ ] Kopiera **live** secret key (`sk_live_...`)
- [ ] Skapa **live** webhook endpoint med samma events som test:
  - `account.updated`
  - `payment_intent.canceled`
  - `payment_intent.payment_failed`
  - `payment_intent.succeeded`
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Kopiera **live** webhook signing secret (`whsec_...`)
- [ ] Skapa Skyltfönstret-produkt + pris i Live Mode (69 SEK/mån recurring)
- [ ] Kopiera **live** Price ID (`price_...`)
- [ ] Konfigurera Customer Portal i Live Mode (Settings → Billing → Customer portal)

### Sätt live-nycklar i Supabase:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SKYLTFONSTRET_PRICE_ID=price_...
```

### Sätt live publishable key i prod wrangler:
Lägg till i `web/wrangler.jsonc` under `vars`:
```json
"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_..."
```

## 3. Supabase — produktionshärdning
- [ ] **Kör alla migrations** i ordning (00001–00010)
- [ ] **Verifiera extensions:** `pg_cron`, `pg_trgm`, `postgis` är aktiverade
- [ ] **Uppdatera edge functions deploy list:**
```bash
npx supabase functions deploy booking-create
npx supabase functions deploy stripe-connect-create
npx supabase functions deploy stripe-connect-status
npx supabase functions deploy stripe-connect-refresh
npx supabase functions deploy stripe-payment-capture
npx supabase functions deploy stripe-payment-cancel
npx supabase functions deploy stripe-webhooks
npx supabase functions deploy organizer-stats
npx supabase functions deploy skyltfonstret-checkout
npx supabase functions deploy skyltfonstret-portal
```
- [ ] **Sätt PostHog secrets:**
```bash
supabase secrets set POSTHOG_PRIVATE_API_KEY=phx_...
supabase secrets set POSTHOG_PROJECT_ID=...
supabase secrets set POSTHOG_HOST=https://eu.i.posthog.com
```
- [ ] **Rate limiting:** Dashboard → Project Settings → API → Sätt 100 req/min per IP
- [ ] **Backups:** Överväg Pro-plan ($25/mån) för Point-in-Time Recovery

## 4. Cloudflare — prod deploy
- [ ] Verifiera att `fyndstigen.se` DNS pekar till Cloudflare
- [ ] Verifiera custom domains i `wrangler.jsonc` (`fyndstigen.se` + `www.fyndstigen.se`)
- [ ] Bygg och deploya:
```bash
cd web && node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build
cd .. && node node_modules/wrangler/bin/wrangler.js deploy --config web/wrangler.jsonc --x-autoconfig=false
```
- [ ] Testa att `https://fyndstigen.se` svarar med HTTPS
- [ ] Testa att `https://www.fyndstigen.se` redirectar till `fyndstigen.se` (eller tvärtom)

## 5. Supabase Auth — produktions-URL
- [ ] Supabase Dashboard → Authentication → URL Configuration
- [ ] Sätt **Site URL** till `https://fyndstigen.se`
- [ ] Lägg till `https://fyndstigen.se` i **Redirect URLs**
- [ ] Ta bort `localhost` från Redirect URLs (eller behåll för lokal dev)
- [ ] Om Google Login: uppdatera OAuth-redirect i Google Cloud Console

## 6. Testa hela flödet i Live Mode
- [ ] Skapa konto (registrera + logga in)
- [ ] Skapa en loppis som arrangör
- [ ] Koppla Stripe Connect (arrangör)
- [ ] Publicera loppisen
- [ ] Logga in som annan användare → boka bord → betala med riktigt kort
- [ ] Godkänn bokning som arrangör → verifiera capture
- [ ] Neka bokning → verifiera att pengar släpps
- [ ] Testa gratis bokning (0 kr bord)
- [ ] Testa Skyltfönstret → uppgradera → verifiera SEO syns
- [ ] Testa Skyltfönstret → avsluta via Customer Portal → verifiera nedgradering
- [ ] Testa sökning
- [ ] Testa loppisrunda → skapa, optimera, spara
- [ ] Verifiera cookie-banner → acceptera → PostHog events syns
- [ ] Verifiera cookie-banner → neka → inga PostHog events

## 7. SEO — verifiera
- [ ] Kolla `https://fyndstigen.se/sitemap.xml` — alla loppisar och rundor listade
- [ ] Kolla `https://fyndstigen.se/robots.txt` — rätt disallow-regler
- [ ] Google Search Console → lägg till property → verifiera domän → skicka in sitemap
- [ ] Testa en loppissida i [Rich Results Test](https://search.google.com/test/rich-results) → LocalBusiness schema ska validera

## 8. Monitoring
- [ ] Sentry — verifiera att fel dyker upp i dashboarden
- [ ] PostHog — verifiera att events loggas (efter cookie-consent)
- [ ] Supabase Dashboard → Logs — kolla att edge functions loggar korrekt
- [ ] Stripe Dashboard → Developers → Webhooks — verifiera att events levereras med 200

## 9. Innan du bjuder in beta-testare
- [ ] Skapa ett testkonto åt varje beta-testare (eller låt dem registrera sig)
- [ ] Skriv kort instruktion: "gå till fyndstigen.se, skapa konto, prova att..."
- [ ] Ha en kanal för feedback (Slack/Discord/mejl)
- [ ] Övervaka Sentry + Supabase logs de första dagarna
