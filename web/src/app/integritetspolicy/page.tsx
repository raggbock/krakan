import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Integritetspolicy',
  description: 'Så hanterar Fyndstigen dina personuppgifter.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka
      </Link>

      <h1 className="font-display text-3xl font-bold mb-2">Integritetspolicy</h1>
      <p className="text-sm text-espresso/60 mb-8">Senast uppdaterad: 16 april 2026</p>

      <div className="prose prose-espresso max-w-none space-y-8 text-sm leading-relaxed text-espresso/80">

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">1. Personuppgiftsansvarig</h2>
          <p>
            Sebastian Myrdahl<br />
            E-post: <a href="mailto:info@fyndstigen.se" className="text-rust">info@fyndstigen.se</a>
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">2. Vilka uppgifter vi samlar in</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-espresso/10 text-left">
                <th className="pb-2 font-semibold text-espresso">Uppgift</th>
                <th className="pb-2 font-semibold text-espresso">Syfte</th>
                <th className="pb-2 font-semibold text-espresso">Rättslig grund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-espresso/5">
              <tr>
                <td className="py-2">Namn, e-post, telefon</td>
                <td className="py-2">Skapa och hantera ditt konto</td>
                <td className="py-2">Avtal</td>
              </tr>
              <tr>
                <td className="py-2">Bokningsuppgifter</td>
                <td className="py-2">Hantera bordsbokningar</td>
                <td className="py-2">Avtal</td>
              </tr>
              <tr>
                <td className="py-2">Betaluppgifter</td>
                <td className="py-2">Betalningshantering via Stripe</td>
                <td className="py-2">Avtal</td>
              </tr>
              <tr>
                <td className="py-2">Platsdata (loppisrundor)</td>
                <td className="py-2">Skapa och visa rutter</td>
                <td className="py-2">Samtycke</td>
              </tr>
              <tr>
                <td className="py-2">Sidvisningar, klick</td>
                <td className="py-2">Förbättra tjänsten</td>
                <td className="py-2">Berättigat intresse / Samtycke</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">3. Tredjeparter</h2>
          <p>Vi delar uppgifter med följande tjänster för att Fyndstigen ska fungera:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Supabase</strong> (Frankfurt, EU) — databas och inloggning</li>
            <li><strong>Stripe</strong> (EU/US) — betalningshantering aktiveras när Fyndstigen öppnar bordsbokning med betalning. Stripe är självständigt personuppgiftsansvarig för betaldata. <a href="https://stripe.com/privacy" className="text-rust" target="_blank" rel="noopener noreferrer">Stripes integritetspolicy</a></li>
            <li><strong>PostHog</strong> (Frankfurt, EU) — webbanalys, endast med ditt samtycke</li>
            <li><strong>Sentry</strong> (Frankfurt, EU) — felrapportering från webbläsaren. PII (IP, cookies) skickas bara om du accepterat cookies.</li>
            <li><strong>Cloudflare</strong> (global, EU-avtal) — hosting och CDN</li>
          </ul>
          <p className="mt-2">Vi säljer aldrig dina personuppgifter till tredje part.</p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">4. Cookies</h2>
          <p>Fyndstigen använder följande cookies:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Nödvändiga cookies</strong> — inloggningssession (Supabase auth). Kan inte stängas av.</li>
            <li><strong>Analytikcookies</strong> (PostHog) — spårar sidvisningar och interaktioner för att förbättra tjänsten. Sätts <em>bara</em> om du accepterar cookies i bannern.</li>
            <li><strong>Betalcookies</strong> (Stripe) — sätts vid betalning för bedrägeriförebyggande.</li>
          </ul>
          <p className="mt-2">
            Du kan ändra ditt val när som helst via länken <strong>&quot;Cookie-inställningar&quot;</strong> längst ner på sidan.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">5. Lagringstid</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kontouppgifter — så länge du har ett konto</li>
            <li>Bokningsdata — 3 år efter bokningstillfället (bokföringslagen)</li>
            <li>Analysdata — 26 månader (PostHog default)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">6. Dina rättigheter</h2>
          <p>Enligt GDPR har du rätt att:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Få tillgång</strong> till dina personuppgifter</li>
            <li><strong>Rätta</strong> felaktiga uppgifter</li>
            <li><strong>Radera</strong> dina uppgifter ("rätten att bli glömd")</li>
            <li><strong>Exportera</strong> dina uppgifter (dataportabilitet)</li>
            <li><strong>Invända</strong> mot behandling baserad på berättigat intresse</li>
            <li><strong>Återkalla samtycke</strong> för analytikcookies</li>
          </ul>
          <p className="mt-2">
            Kontakta oss på <a href="mailto:info@fyndstigen.se" className="text-rust">info@fyndstigen.se</a> för att utöva dina rättigheter.
            Du har också rätt att klaga till <a href="https://www.imy.se" className="text-rust" target="_blank" rel="noopener noreferrer">Integritetsskyddsmyndigheten (IMY)</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">7. Ändringar</h2>
          <p>
            Vi kan uppdatera denna policy. Vid väsentliga ändringar meddelar vi dig via e-post eller en notis i tjänsten.
          </p>
        </section>

      </div>
    </div>
  )
}
