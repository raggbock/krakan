import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Frågor & svar',
  description:
    'Vanliga frågor om Fyndstigen — hur du hittar loppisar, bokar bord, planerar din loppisrunda och publicerar din egen loppis.',
  alternates: { canonical: '/fragor-svar' },
}

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Vad är Fyndstigen?',
    a: 'Fyndstigen är en plattform som samlar Sveriges loppisar och loppmarknader på ett ställe. Du kan söka loppisar nära dig, se öppettider, boka bord direkt och planera en loppisrunda mellan flera stopp.',
  },
  {
    q: 'Hur hittar jag loppisar nära mig?',
    a: 'Använd kartan eller sök på din ort. Du kan också bläddra bland loppisar per stad via vår katalog.',
  },
  {
    q: 'Hur bokar jag ett bord på en loppis?',
    a: 'Öppna loppisens sida, välj ett ledigt bord och datum, och skicka din bokning. Vissa arrangörer godkänner bokningar direkt, andra svarar inom kort.',
  },
  {
    q: 'Kostar det att använda Fyndstigen?',
    a: 'Det är gratis att leta loppisar, boka bord och publicera din egen loppis. Arrangörer betalar bara en liten provision på betalda bokningar.',
  },
  {
    q: 'Hur publicerar jag min egen loppis?',
    a: 'Skapa ett konto, gå till din profil och välj "Skapa ny loppis". Lägg till information, öppettider, eventuella bord och publicera. Det tar några minuter.',
  },
  {
    q: 'Vad är en loppisrunda?',
    a: 'En loppisrunda är en kedja av loppisar du planerar att besöka samma dag. Fyndstigen optimerar rutten åt dig så du sparar tid mellan stoppen.',
  },
  {
    q: 'Vilka städer finns Fyndstigen i?',
    a: 'Vi täcker hela Sverige. Tillgängligheten beror på var arrangörer publicerat loppisar — vill du se din ort representerad, dela gärna sidan med lokala arrangörer.',
  },
  {
    q: 'Hur kontaktar jag en arrangör?',
    a: 'På varje loppis-sida hittar du arrangörens publika profil med kontaktinfo. När du skickar en bokning kan du även lämna ett meddelande direkt.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function FaqPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />

      <h1 className="font-display text-3xl sm:text-4xl font-bold">Frågor & svar</h1>
      <p className="text-espresso/65 mt-2">
        Vanliga frågor om hur Fyndstigen funkar.
      </p>

      <div className="mt-10 space-y-3">
        {faqs.map((f, i) => (
          <details key={i} className="vintage-card p-5 group">
            <summary className="font-display font-bold cursor-pointer flex items-center justify-between">
              <span>{f.q}</span>
              <span className="text-rust text-xl group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-espresso/75 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 vintage-card p-6 text-center">
        <p className="font-display font-bold">Hittar du inte svaret?</p>
        <p className="text-sm text-espresso/65 mt-1">
          Hör av dig till oss på{' '}
          <a href="mailto:hej@fyndstigen.se" className="text-rust hover:underline">
            hej@fyndstigen.se
          </a>
        </p>
        <Link
          href="/"
          className="inline-block mt-5 bg-rust text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors"
        >
          Tillbaka till start
        </Link>
      </div>
    </div>
  )
}
