import type { Metadata } from 'next'
import { Fraunces, Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { Nav } from '@/components/nav'
import { TrailBackground } from '@/components/trail-background'
import { PostHogProvider, PostHogPageview } from '@/lib/posthog'
import { QueryProvider } from '@/providers/query-provider'
import { Suspense } from 'react'
import { CookieConsent } from '@/components/cookie-consent'
import Link from 'next/link'

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
  title: {
    default: 'Fyndstigen — Hitta loppisar nära dig',
    template: '%s | Fyndstigen',
  },
  description:
    'Fyndstigen samlar loppisar och loppmarknader på ett ställe. Hitta second hand-skatter, boka bord och planera din loppisrunda.',
  keywords: [
    'loppis',
    'loppisar',
    'loppmarknad',
    'second hand',
    'fynd',
    'vintage',
    'retro',
    'begagnat',
    'fyndstigen',
    'boka bord loppis',
    'loppisrunda',
  ],
  authors: [{ name: 'Fyndstigen' }],
  creator: 'Fyndstigen',
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    siteName: 'Fyndstigen',
    title: 'Fyndstigen — Hitta loppisar nära dig',
    description:
      'Samlar loppisar på ett ställe. Hitta fynd, boka bord och planera din loppisrunda.',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fyndstigen — Hitta loppisar nära dig',
    description:
      'Samlar loppisar på ett ställe. Hitta fynd, boka bord och planera din loppisrunda.',
    images: ['/logo-512.png'],
  },
  alternates: {
    canonical: '/',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="sv"
      className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}
    >
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
          <QueryProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
            <TrailBackground />
            <Nav />
            <main className="flex-1 relative" style={{ zIndex: 1 }}>{children}</main>
            <footer className="border-t border-cream-warm mt-auto relative" style={{ zIndex: 1 }}>
              <div className="max-w-6xl mx-auto px-6 py-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <p className="font-display font-bold text-lg text-espresso">
                      Fyndstigen
                    </p>
                    <p className="text-sm text-espresso/65 mt-1">
                      Varje stig leder till ett fynd.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-espresso/60">
                    <Link href="/fragor-svar" className="hover:text-espresso transition-colors">
                      Frågor & svar
                    </Link>
                    <Link href="/integritetspolicy" className="hover:text-espresso transition-colors">
                      Integritetspolicy
                    </Link>
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
