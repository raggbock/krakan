import type { Metadata } from 'next'
import { Fraunces, Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth/auth-context'
import { Nav } from '@/components/nav'
import { TrailBackgroundLazy } from '@/components/trail-background-lazy'
import { PostHogProvider, PostHogPageview } from '@/lib/analytics/posthog'
import { QueryProvider } from '@/providers/query-provider'
import { Suspense, cache } from 'react'
import { CookieConsent } from '@/components/cookie-consent'
import { CookieSettingsLink } from '@/components/cookie-settings-link'
import { WebVitalsReporter } from '@/components/web-vitals-reporter'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData, slugifyCity } from '@fyndstigen/shared'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
})

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://fyndstigen.se'),
  icons: {
    // Explicit static icon prevents Next.js from generating a dynamic /icon
    // route (which added ~863ms per takeover page load due to runtime overhead).
    // Serving from /public gives full CDN cache with long max-age headers.
    icon: '/icon.svg',
  },
  title: {
    default: 'Hitta loppis — loppisar och loppmarknader i hela Sverige · Fyndstigen',
    template: '%s · Fyndstigen',
  },
  description:
    'Hitta loppis nära dig. Fyndstigen samlar loppisar, loppmarknader och second hand-butiker i hela Sverige — sök på ort, se öppettider, boka bord och planera din loppisrunda.',
  authors: [{ name: 'Fyndstigen' }],
  creator: 'Fyndstigen',
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    siteName: 'Fyndstigen',
    title: 'Hitta loppis — Loppisar i hela Sverige | Fyndstigen',
    description:
      'Hitta loppis nära dig. Sök bland loppisar och loppmarknader i hela Sverige, se öppettider och planera din loppisrunda.',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hitta loppis — Loppisar i hela Sverige | Fyndstigen',
    description:
      'Hitta loppis nära dig. Sök bland loppisar och loppmarknader i hela Sverige, se öppettider och planera din loppisrunda.',
    images: ['/logo-512.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fyndstigen',
  url: 'https://fyndstigen.se',
  logo: 'https://fyndstigen.se/logo-512.png',
  description:
    'Fyndstigen samlar loppisar och loppmarknader på ett ställe. Hitta second hand-skatter, boka bord och planera din loppisrunda.',
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Fyndstigen',
  url: 'https://fyndstigen.se',
  inLanguage: 'sv-SE',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://fyndstigen.se/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

type PopularCity = { slug: string; canonicalName: string }

// cache() dedupes within a request; revalidate=3600 (on each page) handles
// cross-request staleness. Root layout cannot export `revalidate` itself in
// Next.js App Router — that export only works on page/route segments.
const getPopularCities = cache(async (): Promise<PopularCity[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // CI / build envs use a placeholder URL — skip the fetch (would otherwise
  // wait for DNS lookup to fail, adding seconds to every page render).
  if (!url || !anon || url.includes('placeholder.supabase.co')) return []
  try {
    const supabase = createClient(url, anon)
    const raw = await createSupabaseServerData(supabase).listCitiesWithMarkets()
    // Dedupe by slug (same city with different casings → collapse, sum counts)
    const map = new Map<string, { slug: string; canonicalName: string; marketCount: number }>()
    for (const c of raw) {
      const slug = slugifyCity(c.city)
      const existing = map.get(slug)
      if (existing) {
        existing.marketCount += c.marketCount
      } else {
        map.set(slug, { slug, canonicalName: c.city, marketCount: c.marketCount })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.marketCount - a.marketCount)
      .slice(0, 12)
  } catch {
    // Non-fatal — footer degrades gracefully if DB is unreachable at build time.
    return []
  }
})

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const popularCities = await getPopularCities()
  return (
    <html
      lang="sv"
      className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}
    >
      <head>
        {/* Reduce connection latency to Supabase (auth + data) */}
        <link rel="preconnect" href="https://yqeegfhwbjnlrdurstxp.supabase.co" />
        {/* Reduce connection latency to PostHog analytics */}
        <link rel="preconnect" href="https://eu.i.posthog.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://eu-assets.i.posthog.com" crossOrigin="anonymous" />
        {/* DNS prefetch for Sentry (error reporting — doesn't need full preconnect) */}
        <link rel="dns-prefetch" href="https://o.ingest.sentry.io" />
      </head>
      <body className="min-h-full flex flex-col font-body">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <PostHogProvider>
          <WebVitalsReporter />
          <QueryProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
            <TrailBackgroundLazy />
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-espresso focus:text-parchment focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none"
            >
              Hoppa till innehåll
            </a>
            <Nav />
            <main id="main-content" className="flex-1 relative" style={{ zIndex: 1 }}>{children}</main>
            <footer className="border-t border-cream-warm mt-auto relative" style={{ zIndex: 1 }}>
              <div className="max-w-6xl mx-auto px-6 py-10">
                {popularCities.length > 0 && (
                  <div className="mb-8 pb-8 border-b border-cream-warm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-espresso/75 mb-3">
                      Populära städer
                    </p>
                    <ul className="flex flex-wrap gap-x-2 gap-y-1">
                      {popularCities.map((city) => (
                        <li key={city.slug}>
                          <Link
                            href={`/loppisar/${city.slug}`}
                            className="inline-flex items-center min-h-[44px] py-2 px-1 text-sm text-espresso/70 hover:text-espresso transition-colors"
                            prefetch={false}
                          >
                            {city.canonicalName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <p className="font-display font-bold text-lg text-espresso">
                      Fyndstigen
                    </p>
                    <p className="text-sm text-espresso/75 mt-1">
                      Varje stig leder till ett fynd.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-espresso/75">
                    <Link href="/fragor-svar" prefetch={false} className="hover:text-espresso transition-colors">
                      Frågor & svar
                    </Link>
                    <a
                      href="https://fyndstigen.se/integritetspolicy"
                      // Absolute href + English aria-label so Google's OAuth
                      // app-verification scanner picks the link up — the
                      // reviewer couldn't see the footer-only Swedish link.
                      // Keep the English label even though it announces
                      // English to screen readers (compliance > a11y here).
                      aria-label="Privacy Policy"
                      className="hover:text-espresso transition-colors"
                    >
                      Integritetspolicy
                    </a>
                    <CookieSettingsLink />
                    <a
                      href="mailto:hej@fyndstigen.se"
                      className="hover:text-espresso transition-colors"
                    >
                      hej@fyndstigen.se
                    </a>
                    <span>&copy; {new Date().getFullYear()} Fyndstigen</span>
                  </div>
                </div>
              </div>
            </footer>
            <CookieConsent />
          </AuthProvider>
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
