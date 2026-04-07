'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, FleaMarket } from '@/lib/api'
import { KrakanLogo } from '@/components/krakan-logo'

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function ExplorePage() {
  const [markets, setMarkets] = useState<FleaMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.fleaMarkets
          .list({ page: 1, pageSize: 20 })
          .catch(() => ({ items: [], count: 0 }))
        setMarkets(res.items ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isEmpty = !loading && !markets.length

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden vintage-card p-8 sm:p-12 mb-12 animate-fade-up">
        {/* Knit pattern background */}
        <div className="absolute inset-0 knit-bg opacity-50" />

        <div className="relative">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <KrakanLogo size={48} className="text-espresso animate-bob" />
                <span className="stamp text-rust animate-stamp delay-3">
                  Second hand
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight mt-4">
                Hitta loppisar
                <br />
                <span className="text-rust">nära dig</span>
              </h1>

              <p className="text-espresso/60 mt-5 max-w-md text-lg leading-relaxed">
                Kråkan samlar permanenta och tillfälliga loppisar på ett ställe
                &mdash; så att du aldrig missar ett fynd.
              </p>

              <div className="flex flex-wrap gap-4 mt-8">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 bg-rust text-parchment px-6 py-3 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors duration-200 shadow-sm"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="opacity-80"
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <line
                      x1="11"
                      y1="11"
                      x2="14"
                      y2="14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Sök loppisar
                </Link>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 bg-cream-warm text-espresso px-6 py-3 rounded-full text-sm font-semibold hover:bg-mustard/20 transition-colors duration-200"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="opacity-60"
                  >
                    <path
                      d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <circle
                      cx="8"
                      cy="6"
                      r="1.5"
                      fill="currentColor"
                    />
                  </svg>
                  Visa karta
                </Link>
              </div>
            </div>

            {/* Stats badge */}
            {markets.length > 0 && (
              <div className="hidden sm:flex flex-col items-center justify-center bg-mustard/15 rounded-2xl px-6 py-5 min-w-[100px] animate-fade-up delay-4">
                <span className="font-display text-3xl font-bold text-mustard">
                  {markets.length}
                </span>
                <span className="text-xs text-espresso/50 mt-1 font-medium">
                  loppisar
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <KrakanLogo size={40} className="text-rust animate-bob" />
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <section className="vintage-card p-10 text-center animate-fade-up">
          <KrakanLogo
            size={56}
            className="text-espresso/20 mx-auto mb-4"
          />
          <h2 className="font-display text-xl font-bold">
            Inga loppisar ännu
          </h2>
          <p className="text-espresso/50 mt-2 max-w-sm mx-auto">
            När arrangörer börjar publicera loppisar kommer de dyka upp här.
            Kråkan håller utkik!
          </p>
        </section>
      )}

      {/* ── Market Grid ── */}
      {!!markets.length && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold">
                Loppisar nära dig
              </h2>
              <p className="text-sm text-espresso/50 mt-1">
                Bläddra bland loppisar i ditt område.
              </p>
            </div>
            <Link
              href="/map"
              className="text-sm font-medium text-rust hover:text-rust-light transition-colors hidden sm:block"
            >
              Visa alla på karta &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market, i) => (
              <Link
                key={market.id}
                href={`/fleamarkets/${market.id}`}
                className="group vintage-card overflow-hidden hover:shadow-md transition-all duration-300 animate-fade-up"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              >
                {/* Card image area */}
                <div className="h-44 bg-cream-warm knit-bg flex items-center justify-center relative overflow-hidden">
                  <span className="font-display text-4xl font-bold text-espresso/10 group-hover:text-espresso/15 transition-colors duration-300">
                    {getInitials(market.name)}
                  </span>

                  {/* Type stamp */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`stamp text-xs ${
                        market.is_permanent
                          ? 'text-forest'
                          : 'text-mustard'
                      }`}
                    >
                      {market.is_permanent ? 'Permanent' : 'Tillfällig'}
                    </span>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-5">
                  <h3 className="font-display font-bold text-lg group-hover:text-rust transition-colors duration-200">
                    {market.name}
                  </h3>
                  <p className="text-sm text-espresso/50 mt-1.5 flex items-center gap-1.5">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="opacity-50 shrink-0"
                    >
                      <path
                        d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                      />
                    </svg>
                    {market.city}
                  </p>
                  {market.description && (
                    <p className="text-sm text-espresso/60 mt-2.5 line-clamp-2 leading-relaxed">
                      {market.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Tagline ── */}
      <section className="text-center py-12 animate-fade-up delay-5">
        <p className="font-display text-xl text-espresso/30 italic">
          &ldquo;Varje fynd har en historia&rdquo;
        </p>
      </section>
    </div>
  )
}
