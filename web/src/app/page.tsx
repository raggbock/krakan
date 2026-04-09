import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      {/* ════════════════════════════════════════════
          HERO — Full-width, immersive trail opening
          ════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center justify-center px-6">
        {/* Illustrated trail SVG — winds across the entire hero */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden
        >
          {/* Main winding trail */}
          <path
            d="M-40 700 C60 650, 100 580, 180 620 C260 660, 300 560, 400 520 C500 480, 520 400, 600 380 C680 360, 720 300, 800 260 C880 220, 940 280, 1000 220 C1060 160, 1100 120, 1240 100"
            stroke="var(--color-cream-warm)"
            strokeWidth="3"
            strokeDasharray="12 8"
            strokeLinecap="round"
            opacity="0.6"
            className="trail-path"
          />
          {/* Trail waypoint dots */}
          <circle cx="180" cy="620" r="6" fill="var(--color-rust)" opacity="0.08" />
          <circle cx="400" cy="520" r="6" fill="var(--color-mustard)" opacity="0.08" />
          <circle cx="600" cy="380" r="6" fill="var(--color-forest)" opacity="0.08" />
          <circle cx="800" cy="260" r="6" fill="var(--color-lavender)" opacity="0.08" />
          <circle cx="1000" cy="220" r="6" fill="var(--color-rust)" opacity="0.08" />
          {/* Start marker */}
          <circle cx="-20" cy="700" r="10" fill="var(--color-forest)" opacity="0.1" />
          <circle cx="-20" cy="700" r="4" fill="var(--color-forest)" opacity="0.15" />
          {/* Decorative elements scattered along trail */}
          <rect x="130" y="590" width="10" height="8" rx="2" fill="var(--color-mustard)" opacity="0.04" transform="rotate(-12 135 594)" />
          <circle cx="350" cy="550" r="5" fill="var(--color-lavender)" opacity="0.04" />
          <path d="M550 410 L556 395 L562 410" stroke="var(--color-mustard)" strokeWidth="1.5" fill="none" opacity="0.04" />
          <rect x="750" y="285" width="12" height="9" rx="2" fill="var(--color-rust)" opacity="0.04" transform="rotate(6 756 290)" />
          <circle cx="950" cy="245" r="4" fill="var(--color-forest)" opacity="0.04" />
        </svg>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="animate-fade-up">
            <FyndstigenLogo size={72} className="text-espresso mx-auto animate-bob" />
          </div>

          <div className="mt-8 animate-fade-up delay-1">
            <span className="stamp text-rust animate-stamp delay-3 text-sm">
              Sveriges loppisplattform
            </span>
          </div>

          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mt-8 animate-fade-up delay-2">
            Varje stig leder
            <br />
            till ett{' '}
            <span className="text-rust hand-underline">fynd</span>
          </h1>

          <p className="text-espresso/70 mt-8 max-w-xl mx-auto text-lg sm:text-xl leading-relaxed animate-fade-up delay-3">
            Fyndstigen samlar loppisar, loppmarknader och second hand-butiker
            &mdash; sök, boka bord, planera din runda och hitta skatter i ditt
            närområde.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-10 animate-fade-up delay-4">
            <Link
              href="/utforska"
              className="group inline-flex items-center gap-2.5 bg-rust text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-rust-light transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="opacity-80">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Utforska loppisar
            </Link>
            <Link
              href="/profile/create-market"
              className="inline-flex items-center gap-2.5 bg-card text-espresso px-8 py-4 rounded-full text-base font-semibold border border-cream-warm hover:border-rust/30 hover:bg-cream-warm transition-all duration-300"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="opacity-50">
                <line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Publicera en loppis
            </Link>
          </div>

          {/* Scroll hint */}
          <div className="mt-20 animate-fade-in delay-5">
            <div className="flex flex-col items-center gap-2 text-espresso/20">
              <span className="text-xs font-medium tracking-widest uppercase">Följ stigen</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="animate-bob">
                <path d="M4 8L10 14L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          HOW IT WORKS — Three trail waypoints
          ════════════════════════════════════════════ */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16 animate-fade-up">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Tre steg till ditt nästa fynd
          </h2>
          <p className="text-espresso/65 mt-3 max-w-md mx-auto">
            Från soffa till loppisfynd &mdash; snabbt och enkelt.
          </p>
        </div>

        {/* Connecting trail line between cards */}
        <svg className="absolute left-1/2 top-52 -translate-x-1/2 h-[calc(100%-16rem)] w-4 hidden lg:block pointer-events-none" viewBox="0 0 16 600" fill="none" aria-hidden>
          <path d="M8 0 C8 100, 8 100, 8 200 C8 300, 8 300, 8 400 C8 500, 8 500, 8 600" stroke="var(--color-cream-warm)" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
        </svg>

        <div className="grid gap-8 lg:gap-12">
          {/* Step 1 — Discover */}
          <div className="vintage-card p-8 sm:p-10 flex flex-col sm:flex-row items-start gap-6 animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-rust/10 flex items-center justify-center shrink-0">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="12" cy="12" r="8" stroke="var(--color-rust)" strokeWidth="2.5" />
                <line x1="17.5" y1="17.5" x2="24" y2="24" stroke="var(--color-rust)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M8 12h8M12 8v8" stroke="var(--color-rust)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="stamp text-rust text-[10px]">Steg 1</span>
                <h3 className="font-display text-xl font-bold">Hitta loppisar</h3>
              </div>
              <p className="text-espresso/70 leading-relaxed">
                Sök bland hundratals loppisar efter namn, stad eller på kartan.
                Filtrera permanenta butiker och tillfälliga marknader &mdash; se
                öppettider, adress och vad som finns.
              </p>
            </div>
          </div>

          {/* Step 2 — Book */}
          <div className="vintage-card p-8 sm:p-10 flex flex-col sm:flex-row items-start gap-6 animate-fade-up delay-1">
            <div className="w-16 h-16 rounded-2xl bg-mustard/12 flex items-center justify-center shrink-0">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="6" width="20" height="14" rx="2.5" stroke="var(--color-mustard)" strokeWidth="2.5" />
                <line x1="7" y1="20" x2="7" y2="24" stroke="var(--color-mustard)" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="21" y1="20" x2="21" y2="24" stroke="var(--color-mustard)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M10 13h8" stroke="var(--color-mustard)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="stamp text-mustard text-[10px]">Steg 2</span>
                <h3 className="font-display text-xl font-bold">Boka ditt bord</h3>
              </div>
              <p className="text-espresso/70 leading-relaxed">
                Vill du sälja? Välj storlek och datum, skicka en förfrågan direkt
                till arrangören. Du får svar och bekräftelse &mdash; inga samtal,
                inga missförstånd.
              </p>
            </div>
          </div>

          {/* Step 3 — Route */}
          <div className="vintage-card p-8 sm:p-10 flex flex-col sm:flex-row items-start gap-6 animate-fade-up delay-2">
            <div className="w-16 h-16 rounded-2xl bg-forest/10 flex items-center justify-center shrink-0">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="7" cy="7" r="3.5" stroke="var(--color-forest)" strokeWidth="2.5" />
                <circle cx="21" cy="12" r="3.5" stroke="var(--color-forest)" strokeWidth="2.5" />
                <circle cx="11" cy="22" r="3.5" stroke="var(--color-forest)" strokeWidth="2.5" />
                <path d="M10 8.5L18 11M18 14L13 20" stroke="var(--color-forest)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="stamp text-forest text-[10px]">Steg 3</span>
                <h3 className="font-display text-xl font-bold">Planera din runda</h3>
              </div>
              <p className="text-espresso/70 leading-relaxed">
                Skapa en loppisrunda med flera stopp &mdash; Fyndstigen
                optimerar rutten åt dig. Se körtider, avstånd och vilka loppisar
                som är öppna just den dagen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SOCIAL PROOF — Numbers + testimonial feel
          ════════════════════════════════════════════ */}
      <section className="relative py-20 overflow-hidden">
        {/* Subtle background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cream-warm/30 to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up">
            <StatCard number="100+" label="Loppisar" color="rust" />
            <StatCard number="50+" label="Städer" color="forest" />
            <StatCard number="500+" label="Bokningsbara bord" color="mustard" />
            <StatCard number="Gratis" label="Att använda" color="lavender" />
          </div>

          {/* Quote */}
          <div className="mt-16 text-center animate-fade-up delay-2">
            <blockquote className="vintage-card p-8 sm:p-12 max-w-2xl mx-auto">
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none" className="mx-auto mb-4 text-rust/20">
                <path d="M0 24V14.4C0 6.4 4.8 1.6 14.4 0l1.6 4.8C10.4 6.4 8 9.6 8 14.4h6V24H0zm18 0V14.4C18 6.4 22.8 1.6 32 0l-1.6 4.8C24.8 6.4 26 9.6 26 14.4h6V24H18z" fill="currentColor" />
              </svg>
              <p className="font-display text-xl sm:text-2xl font-bold text-espresso/80 leading-relaxed italic">
                &ldquo;Äntligen slipper jag ringa runt till arrangörer &mdash;
                jag hittar, bokar och planerar allt från mobilen.&rdquo;
              </p>
              <footer className="mt-6 text-sm text-espresso/60 font-medium">
                &mdash; Loppis-Lisa, Göteborg
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOR ORGANIZERS — Dual CTA
          ════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Visitor card */}
          <div className="vintage-card p-8 sm:p-10 animate-fade-up">
            <div className="w-12 h-12 rounded-xl bg-rust/10 flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9" stroke="var(--color-rust)" strokeWidth="2" />
                <path d="M11 6v6l4 2" stroke="var(--color-rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="font-display text-2xl font-bold">Letar du fynd?</h3>
            <p className="text-espresso/70 mt-3 leading-relaxed">
              Utforska loppisar i ditt område, spara favoriter, boka bord och
              planera din nästa loppisrunda med vägbeskrivning.
            </p>
            <Link
              href="/utforska"
              className="inline-flex items-center gap-2 mt-6 bg-rust text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors shadow-sm"
            >
              Börja utforska
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Organizer card */}
          <div className="vintage-card p-8 sm:p-10 animate-fade-up delay-1">
            <div className="w-12 h-12 rounded-xl bg-forest/10 flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="3" y="3" width="16" height="16" rx="3" stroke="var(--color-forest)" strokeWidth="2" />
                <path d="M8 11h6M11 8v6" stroke="var(--color-forest)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="font-display text-2xl font-bold">Arrangerar du loppis?</h3>
            <p className="text-espresso/70 mt-3 leading-relaxed">
              Nå tusentals besökare, hantera bokningar digitalt och få statistik
              över intäkter. Publicera din loppis på fem minuter.
            </p>
            <Link
              href="/profile/create-market"
              className="inline-flex items-center gap-2 mt-6 bg-forest text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-forest-light transition-colors shadow-sm"
            >
              Skapa din loppis
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CLOSING CTA — Emotional finish
          ════════════════════════════════════════════ */}
      <section className="relative py-28 text-center px-6">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute bottom-0 left-0 w-full h-32 opacity-[0.04]" viewBox="0 0 1200 120" fill="none" aria-hidden>
            <path d="M0 60 Q150 10, 300 60 T600 60 T900 60 T1200 60" stroke="var(--color-espresso)" strokeWidth="2" strokeDasharray="8 6" />
          </svg>
        </div>

        <div className="relative max-w-2xl mx-auto animate-fade-up">
          <FyndstigenLogo size={56} className="text-rust mx-auto mb-6" />
          <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
            Stigen väntar &mdash;
            <br />
            <span className="text-rust">vart leder din?</span>
          </h2>
          <p className="text-espresso/65 mt-5 text-lg max-w-md mx-auto">
            Gå med tusentals loppis-älskare som redan hittat sin stig till
            nästa fynd.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-espresso text-parchment px-8 py-4 rounded-full text-base font-semibold hover:bg-espresso-light transition-all duration-300 shadow-md"
            >
              Skapa konto &mdash; gratis
            </Link>
            <Link
              href="/utforska"
              className="inline-flex items-center gap-2 text-rust font-semibold text-base hover:text-rust-light transition-colors px-4 py-4"
            >
              Eller börja utforska direkt &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  number,
  label,
  color,
}: {
  number: string
  label: string
  color: 'rust' | 'forest' | 'mustard' | 'lavender'
}) {
  const bgMap = {
    rust: 'bg-rust/8',
    forest: 'bg-forest/8',
    mustard: 'bg-mustard/8',
    lavender: 'bg-lavender/8',
  }
  const textMap = {
    rust: 'text-rust',
    forest: 'text-forest',
    mustard: 'text-mustard',
    lavender: 'text-lavender',
  }

  return (
    <div className={`rounded-2xl ${bgMap[color]} p-6 text-center`}>
      <span className={`font-display text-3xl sm:text-4xl font-bold ${textMap[color]}`}>
        {number}
      </span>
      <p className="text-sm text-espresso/65 mt-1 font-medium">{label}</p>
    </div>
  )
}
