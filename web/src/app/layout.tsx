import type { Metadata } from 'next'
import { Fraunces, Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { Nav } from '@/components/nav'

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
  title: 'Kråkan — Hitta loppisar nära dig',
  description:
    'Kråkan samlar loppisar och loppmarknader på ett ställe. Hitta second hand-skatter nära dig.',
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
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-cream-warm mt-auto">
            <div className="max-w-6xl mx-auto px-6 py-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <p className="font-display font-bold text-lg text-espresso">
                    Kråkan
                  </p>
                  <p className="text-sm text-espresso/50 mt-1">
                    Varje fynd har en historia.
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm text-espresso/40">
                  <span>&copy; {new Date().getFullYear()} Kråkan</span>
                </div>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
