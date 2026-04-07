'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, FleaMarket } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { KrakanLogo } from '@/components/krakan-logo'

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, signOut, loading: authLoading } = useAuth()
  const [myMarkets, setMyMarkets] = useState<FleaMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth')
      return
    }
    loadMyMarkets()
  }, [user, authLoading])

  async function loadMyMarkets() {
    try {
      setLoading(true)
      const res = await api.fleaMarkets.listByOrganizer(user!.id)
      setMyMarkets(res)
    } catch {
      setMyMarkets([])
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <KrakanLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Profile header */}
      <div className="vintage-card p-8 mb-6 animate-fade-up">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rust/10 flex items-center justify-center">
            <KrakanLogo size={28} className="text-rust" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Min profil</h1>
            <p className="text-sm text-espresso/50 mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* My markets */}
      <div className="vintage-card p-8 mb-6 animate-fade-up delay-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold">Mina loppisar</h2>
            <p className="text-sm text-espresso/50 mt-0.5">
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
            {myMarkets.map((market) => (
              <Link
                key={market.id}
                href={`/fleamarkets/${market.id}`}
                className="group flex items-center justify-between bg-parchment rounded-xl p-4 hover:bg-cream-warm transition-colors duration-200"
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
                      <span className="text-xs text-espresso/40">
                        {market.city}
                      </span>
                      {!market.published_at && (
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
          <div className="text-center py-8">
            <KrakanLogo
              size={40}
              className="text-espresso/10 mx-auto mb-3"
            />
            <p className="text-sm text-espresso/40">
              Du har inga loppisar ännu.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="vintage-card p-8 mb-6 animate-fade-up delay-2">
        <h2 className="font-display text-lg font-bold mb-2">
          Skapa en loppis
        </h2>
        <p className="text-sm text-espresso/50 mb-5">
          Publicera din loppis så att besökare kan hitta den.
        </p>
        <Link
          href="/profile/create-market"
          className="inline-flex items-center gap-2 bg-rust text-parchment px-6 py-3 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors duration-200 shadow-sm"
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
      <button
        onClick={async () => {
          await signOut()
          router.push('/')
        }}
        className="w-full h-12 rounded-xl bg-cream-warm text-sm font-medium text-espresso/60 hover:bg-espresso/8 transition-colors duration-200 animate-fade-up delay-3"
      >
        Logga ut
      </button>
    </div>
  )
}
