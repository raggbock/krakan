import type { Metadata } from 'next'
import { Fraunces, Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { Nav } from '@/components/nav'
import { TrailBackground } from '@/components/trail-background'

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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fyndstigen — Hitta loppisar nära dig',
    description:
      'Samlar loppisar på ett ställe. Hitta fynd, boka bord och planera din loppisrunda.',
  },
  robots: {
    index: true,
    follow: true,
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
        <AuthProvider>
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
                <div className="flex items-center gap-6 text-sm text-espresso/40">
                  <span>&copy; {new Date().getFullYear()} Fyndstigen</span>
                </div>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
