'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { getInitials } from '@fyndstigen/shared'
import { useMarketsByOrganizer } from '@/hooks/use-markets'
import { useRoutesByUser } from '@/hooks/use-routes'
import { usePendingBookingsCount } from '@/hooks/use-pending-bookings-count'
import { StripeConnectButton } from '@/components/stripe-connect-button'
import { useFlag } from '@/lib/flags'

export default function ProfilePage() {
  const router = useRouter()
  const { user, signOut, loading: authLoading } = useAuth()
  const { markets: myMarkets, loading: marketsLoading } = useMarketsByOrganizer(user?.id)
  const { routes: myRoutes, loading: routesLoading } = useRoutesByUser(user?.id)
  const { count: pendingCount } = usePendingBookingsCount(user?.id)
  const paymentsEnabled = useFlag('payments')
  const loading = authLoading || marketsLoading || routesLoading

  useEffect(() => {
    if (authLoading) return
    if (!user) router.push('/auth')
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  const isNewOrganizer = myMarkets.length === 0 && myRoutes.length === 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* First-time welcome — prioritizes the single most useful next step */}
      {isNewOrganizer && (
        <div className="vintage-card p-6 sm:p-8 mb-6 animate-fade-up bg-gradient-to-br from-rust/5 to-mustard/5 border border-rust/15">
          <h2 className="font-display text-xl font-bold">Välkommen till Fyndstigen!</h2>
          <p className="text-sm text-espresso/70 mt-2 max-w-lg">
            Kom igång genom att publicera din första loppis — eller planera en
            runda bland loppisar du vill besöka.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href="/profile/create-market"
              className="inline-flex items-center gap-2 bg-rust text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors shadow-sm"
            >
              Skapa din första loppis
            </Link>
            <Link
              href="/rundor/skapa"
              className="inline-flex items-center gap-2 text-forest font-semibold text-sm hover:text-forest-light transition-colors px-3 py-2.5"
            >
              Planera en runda &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Draft markets notice */}
      {myMarkets.some((m) => !m.published_at) && (
        <div className="bg-mustard/10 border border-mustard/20 rounded-xl px-4 py-3 text-sm text-mustard mb-6 animate-fade-up">
          Du har opublicerade utkast — redigera dem för att publicera.
        </div>
      )}

      {/* Profile header */}
      <div className="vintage-card p-8 mb-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-rust/10 flex items-center justify-center">
              <FyndstigenLogo size={28} className="text-rust" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Min profil</h1>
              <p className="text-sm text-espresso/65 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <Link
            href="/profile/edit"
            className="text-sm font-medium text-rust hover:text-rust-light transition-colors"
          >
            Redigera
          </Link>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2 mt-5">
          <Link
            href="/profile/bokningar"
            className="inline-flex items-center gap-1.5 bg-cream-warm px-4 py-2 rounded-full text-xs font-semibold text-espresso/60 hover:bg-mustard/15 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="11" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="11" x2="12" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Bokningar
            {pendingCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rust text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            href={`/arrangorer/${user?.id}`}
            className="inline-flex items-center gap-1.5 bg-cream-warm px-4 py-2 rounded-full text-xs font-semibold text-espresso/60 hover:bg-rust/10 transition-colors"
          >
            Min publika profil
          </Link>
        </div>
      </div>

      {/* Stripe Connect */}
      {paymentsEnabled && (
        <div className="vintage-card p-8 mb-6 animate-fade-up delay-1">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-forest/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-forest">
                <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <line x1="1" y1="7.5" x2="15" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-lg mb-1">Betalning</h2>
              <StripeConnectButton userId={user?.id} />
            </div>
          </div>
        </div>
      )}

      {/* My markets */}
      <div className="vintage-card p-8 mb-6 animate-fade-up delay-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold">Mina loppisar</h2>
            <p className="text-sm text-espresso/65 mt-0.5">
              Hantera dina loppmarknader.
            </p>
          </div>
          {myMarkets.length > 0 && (
            <span className="stamp text-rust text-xs">
              {myMarkets.length} st
            </span>
          )}
        </div>

        {myMarkets.length > 0 ? (
          <div className="space-y-3 mt-4">
            {myMarkets.map((market) => {
              const isHidden = !!market.published_at && market.isVisible === false
              return (
                <div key={market.id}>
                  <Link
                    href={`/fleamarkets/${market.id}`}
                    className={`group flex items-center justify-between bg-parchment p-4 hover:bg-cream-warm transition-colors duration-200 ${isHidden ? 'rounded-t-xl' : 'rounded-xl'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cream-warm knit-bg flex items-center justify-center">
                        <span className="font-display text-xs font-bold text-espresso/20">
                          {getInitials(market.name)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium group-hover:text-rust transition-colors">
                          {market.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-espresso/60">
                            {market.city}
                          </span>
                          {!market.published_at && (
                            <span className="text-xs text-mustard font-medium">
                              Utkast
                            </span>
                          )}
                          {isHidden && (
                            <span className="text-xs text-lavender font-medium">
                              Gömd
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-espresso/20 group-hover:text-rust/40 transition-colors">
                      &rarr;
                    </span>
                  </Link>
                  {isHidden && (
                    <div className="px-4 pb-3 -mt-1 bg-parchment rounded-b-xl border-t border-espresso/5">
                      <p className="text-xs italic text-espresso/60 mb-1">
                        Tillfällig loppis utan framtida öppningsdagar. Lägg till nya datum för att synas igen.
                      </p>
                      <Link
                        href={`/fleamarkets/${market.id}/edit#opening-hours`}
                        className="text-xs font-semibold text-rust hover:text-rust-light transition-colors"
                      >
                        + Lägg till datum
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <FyndstigenLogo
              size={40}
              className="text-espresso/10 mx-auto mb-3"
            />
            <p className="text-sm text-espresso/60">
              Du har inga loppisar ännu.
            </p>
          </div>
        )}
      </div>

      {/* My routes */}
      <div className="vintage-card p-8 mb-6 animate-fade-up delay-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold">Mina rundor</h2>
            <p className="text-sm text-espresso/65 mt-0.5">
              Dina sparade loppisrundor.
            </p>
          </div>
          {myRoutes.length > 0 && (
            <span className="stamp text-rust text-xs">
              {myRoutes.length} st
            </span>
          )}
        </div>

        {myRoutes.length > 0 ? (
          <div className="space-y-3 mt-4">
            {myRoutes.map((route) => (
              <Link
                key={route.id}
                href={`/rundor/${route.id}`}
                className="group flex items-center justify-between bg-parchment rounded-xl p-4 hover:bg-cream-warm transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rust/10 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-rust">
                      <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="15" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="8" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 6.5L13 7.5M13 10L9.5 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium group-hover:text-rust transition-colors">
                      {route.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-espresso/60">
                        {route.stopCount} stopp
                      </span>
                      {!route.is_published && (
                        <span className="text-xs text-mustard font-medium">
                          Utkast
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-espresso/20 group-hover:text-rust/40 transition-colors">
                  &rarr;
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-espresso/60">
              Du har inga sparade rundor.
            </p>
            <Link
              href="/rundor/skapa"
              className="inline-block mt-3 text-sm font-semibold text-rust hover:text-rust-light transition-colors"
            >
              Skapa din första runda &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="vintage-card p-8 mb-6 animate-fade-up delay-4">
        <h2 className="font-display text-lg font-bold mb-2">
          Skapa en loppis
        </h2>
        <p className="text-sm text-espresso/65 mb-5">
          Publicera din loppis så att besökare kan hitta den.
        </p>
        <Link
          href="/profile/create-market"
          className="inline-flex items-center gap-2 bg-rust text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors duration-200 shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line
              x1="7"
              y1="1"
              x2="7"
              y2="13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="1"
              y1="7"
              x2="13"
              y2="7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Skapa ny loppis
        </Link>
      </div>

      {/* Sign out */}
      <SignOutButton signOut={signOut} onDone={() => router.push('/')} />
    </div>
  )
}

function SignOutButton({ signOut, onDone }: { signOut: () => Promise<void>; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await signOut()
          onDone()
        } catch {
          setBusy(false)
        }
      }}
      className="w-full h-12 rounded-xl bg-cream-warm text-sm font-medium text-espresso/60 hover:bg-espresso/8 transition-colors duration-200 animate-fade-up delay-4 disabled:opacity-50"
    >
      {busy ? 'Loggar ut...' : 'Logga ut'}
    </button>
  )
}
