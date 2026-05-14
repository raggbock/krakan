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
      <p className="text-sm text-espresso/60 mb-8">Senast uppdaterad: 12 maj 2026</p>

      <div className="prose prose-espresso max-w-none space-y-8 text-sm leading-relaxed text-espresso/80">

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">1. Personuppgiftsansvarig</h2>
          <p>
            Sebastian Myrdahl<br />
            E-post: <a href="mailto:info@fyndstigen.se" className="text-rust underline">info@fyndstigen.se</a>
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
            <li><strong>Stripe</strong> (EU/US) — betalningshantering aktiveras när Fyndstigen öppnar bordsbokning med betalning. Stripe är självständigt personuppgiftsansvarig för betaldata. <a href="https://stripe.com/privacy" className="text-rust underline" target="_blank" rel="noopener noreferrer">Stripes integritetspolicy</a></li>
            <li><strong>PostHog</strong> (Frankfurt, EU) — webbanalys, endast med ditt samtycke. Vi spårar bland annat sökfraser du anger i sökfältet — använd inte fältet för att skriva in personuppgifter (eget namn, adresser etc).</li>
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
          <h2 className="font-display text-lg font-bold text-espresso mb-3">5. Följ-funktion och notifikationer</h2>
          <p>
            Inloggade användare kan följa enskilda loppisar och bevaka städer för att hålla sig uppdaterade
            om nyheter. Nedan beskrivs hur vi hanterar de uppgifter som samlas in i samband med den funktionen.
          </p>

          <h3 className="font-semibold text-espresso mt-4 mb-1">Vad vi lagrar</h3>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><strong>Följ-relationer</strong> — vilka loppisar och städer du följer samt tidpunkten för när följningen skapades.</li>
            <li><strong>Notifikationsinställningar</strong> — om du har e-postsammanfattning aktiverad eller inte, samt en kryptografiskt slumpad avprenumerations-token knuten till ditt konto.</li>
            <li><strong>Notishistorik</strong> — en logg över händelser (t.ex. ny loppis i en stad du bevakar) och om och när de levererats till dig.</li>
          </ul>

          <h3 className="font-semibold text-espresso mt-4 mb-1">När vi skickar e-post</h3>
          <p>
            Om du har e-postsammanfattning aktiverad skickar vi ett dagligt e-postmeddelande kl 06:00 svensk tid
            med en sammanfattning av vad som hänt på loppisar och städer du följer det senaste dygnet.
            Vi skickar <em>inget</em> e-postmeddelande dagar utan händelser. Vi skickar aldrig marknadsföringsutskick
            eller e-post av annan anledning än just denna digest.
          </p>

          <h3 className="font-semibold text-espresso mt-4 mb-1">Ditt val att avsäga dig</h3>
          <p>
            Du kan när som helst stänga av e-postsammanfattningen via inställningar i din profil
            under <a href="/profile/notifikationer" className="text-rust underline">Notifikationsinställningar</a>.
            Varje e-postmeddelande innehåller också en personlig avprenumerationslänk som stänger av
            framtida utskick med ett enda klick — utan att du behöver logga in.
            Din in-app-inkorg fortsätter att fungera oavsett e-postinställning.
          </p>

          <h3 className="font-semibold text-espresso mt-4 mb-1">Lagringstid för notishistorik</h3>
          <p>
            Notishistorik (leveransloggar) raderas automatiskt 30 dagar efter att de skapades.
            Händelseloggar utan kvarvarande leveransposter rensas i samband med det.
            Följ-relationer och notifikationsinställningar sparas så länge du har ett konto.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">6. Lagringstid</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kontouppgifter — så länge du har ett konto</li>
            <li>Bokningsdata — 3 år efter bokningstillfället (bokföringslagen)</li>
            <li>Notishistorik — 30 dagar (se avsnitt 5)</li>
            <li>Analysdata — 26 månader (PostHog default)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">7. Dina rättigheter</h2>
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
            Kontakta oss på <a href="mailto:info@fyndstigen.se" className="text-rust underline">info@fyndstigen.se</a> för att utöva dina rättigheter.
            Du har också rätt att klaga till <a href="https://www.imy.se" className="text-rust underline" target="_blank" rel="noopener noreferrer">Integritetsskyddsmyndigheten (IMY)</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-espresso mb-3">8. Ändringar</h2>
          <p>
            Vi kan uppdatera denna policy. Vid väsentliga ändringar meddelar vi dig via e-post eller en notis i tjänsten.
          </p>
        </section>

      </div>
    </div>
  )
}
