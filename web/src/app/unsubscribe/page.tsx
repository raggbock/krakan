import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { UnsubscribeTracker } from './unsubscribe-tracker'

export const metadata: Metadata = {
  title: 'Avsluta e-postprenumeration – Fyndstigen',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams

  let success = false
  let alreadyDisabled = false

  if (token) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('unsubscribe_by_token', {
      p_token: token,
    })

    if (!error) {
      if (data === true) {
        success = true
      } else {
        // data === false means token matched but was already disabled
        alreadyDisabled = true
      }
    }
  }

  const invalidToken = !token || (!success && !alreadyDisabled)

  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-cream-warm">
      <div className="max-w-md w-full text-center">
        <Link href="/" className="inline-block mb-8">
          <FyndstigenLogo size={36} className="text-rust mx-auto" />
        </Link>

        {success && (
          <div className="vintage-card p-8 animate-fade-up">
            <UnsubscribeTracker />
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-forest/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-forest">
                <path d="M5 12L10 17L19 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold mb-3">
              Prenumeration avslutad
            </h1>
            <p className="text-espresso/70 text-sm leading-relaxed">
              Du kommer inte längre att få dagliga e-postsammanfattningar från Fyndstigen.
              Din in-app-inkorg fortsätter att fungera som vanligt.
            </p>
            <p className="text-espresso/50 text-xs mt-4">
              Ändrade dig?{' '}
              <Link
                href="/profile/notifikationer"
                className="text-rust hover:text-rust-light underline transition-colors"
              >
                Aktivera e-postsammanfattning igen
              </Link>
            </p>
          </div>
        )}

        {alreadyDisabled && (
          <div className="vintage-card p-8 animate-fade-up">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-mustard/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-mustard">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold mb-3">
              Redan avaktiverad
            </h1>
            <p className="text-espresso/70 text-sm leading-relaxed">
              E-postsammanfattningen är redan inaktiverad för ditt konto.
            </p>
            <Link
              href="/profile/notifikationer"
              className="inline-block mt-5 text-sm font-semibold text-rust hover:text-rust-light transition-colors"
            >
              Hantera notifikationsinställningar &rarr;
            </Link>
          </div>
        )}

        {invalidToken && (
          <div className="vintage-card p-8 animate-fade-up">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-error">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold mb-3">
              Tyvärr, länken är ogiltig
            </h1>
            <p className="text-espresso/70 text-sm leading-relaxed">
              Den här avprenumerationslänken är ogiltig eller har redan använts.
              Om du fortfarande vill avsluta prenumerationen kan du göra det via dina inställningar.
            </p>
            <Link
              href="/profile/notifikationer"
              className="inline-block mt-5 text-sm font-semibold text-rust hover:text-rust-light transition-colors"
            >
              Gå till notifikationsinställningar &rarr;
            </Link>
          </div>
        )}

        <p className="mt-6 text-xs text-espresso/40">
          <Link href="/" className="hover:text-espresso/60 transition-colors">
            Tillbaka till Fyndstigen
          </Link>
        </p>
      </div>
    </main>
  )
}
