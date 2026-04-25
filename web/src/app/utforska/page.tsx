'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { getInitials } from '@fyndstigen/shared'
import { useMarkets } from '@/hooks/use-markets'
import { useOpenNowIds } from '@/hooks/use-open-now'

export default function ExplorePage() {
  const [page, setPage] = useState(1)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const pageSize = openNowOnly ? 200 : 20
  const { markets: rawMarkets, count, loading, error } = useMarkets({ page: openNowOnly ? 1 : page, pageSize })
  const { data: openIds, isLoading: openLoading } = useOpenNowIds(openNowOnly)

  const markets = useMemo(() => {
    if (!openNowOnly || !openIds) return rawMarkets
    const set = new Set(openIds)
    return rawMarkets.filter((m) => set.has(m.id))
  }, [rawMarkets, openIds, openNowOnly])

  const isEmpty = !loading && !error && !markets.length
  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden vintage-card p-8 sm:p-12 mb-12 animate-fade-up">
        {/* Trail illustration in hero background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden
        >
          <path
            d="M-20 350 C80 320, 120 280, 200 300 C280 320, 300 260, 380 240 C460 220, 500 260, 580 230 C660 200, 700 160, 820 180"
            stroke="var(--color-cream-warm)"
            strokeWidth="3"
            strokeDasharray="10 6"
            strokeLinecap="round"
            opacity="0.5"
            className="trail-path"
          />
          {/* Trail stop markers */}
          <circle cx="200" cy="300" r="5" fill="var(--color-rust)" opacity="0.12" />
          <circle cx="380" cy="240" r="5" fill="var(--color-rust)" opacity="0.12" />
          <circle cx="580" cy="230" r="5" fill="var(--color-rust)" opacity="0.12" />
          {/* Start pin */}
          <circle cx="-10" cy="350" r="7" fill="var(--color-forest)" opacity="0.15" />
          <circle cx="-10" cy="350" r="3" fill="var(--color-forest)" opacity="0.2" />
          {/* Tiny treasure icons */}
          <rect x="280" y="310" width="8" height="6" rx="1" fill="var(--color-mustard)" opacity="0.06" />
          <circle cx="480" cy="255" r="4" fill="var(--color-lavender)" opacity="0.06" />
          <path d="M670 195 L674 185 L678 195" stroke="var(--color-mustard)" strokeWidth="1" fill="none" opacity="0.06" />
        </svg>

        <div className="relative">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <FyndstigenLogo size={48} className="text-espresso animate-bob" />
                <span className="stamp text-rust animate-stamp delay-3">
                  Second hand
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight mt-4">
                Följ stigen till
                <br />
                <span className="text-rust">nästa fynd</span>
              </h1>

              <p className="text-espresso/60 mt-5 max-w-md text-lg leading-relaxed">
                Fyndstigen samlar loppisar på ett ställe &mdash; hitta
                skatter, boka bord och planera din loppisrunda.
              </p>

              <div className="flex flex-wrap gap-4 mt-8">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 bg-rust text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors duration-200 shadow-sm"
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
                <span className="text-xs text-espresso/65 mt-1 font-medium">
                  loppisar
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Quick filter ── */}
      <section className="mb-6 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => { setOpenNowOnly(!openNowOnly); setPage(1) }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            openNowOnly
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'border-cream-warm text-espresso hover:bg-cream-warm/40'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${openNowOnly ? 'bg-white' : 'bg-emerald-600'}`} />
          Öppet just nu
        </button>
        {openNowOnly && (
          <span className="text-sm text-espresso/60">
            {openLoading ? 'Hämtar öppettider…' : `${markets.length} öppna just nu`}
          </span>
        )}
      </section>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <FyndstigenLogo size={40} className="text-rust animate-bob" />
        </div>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <section className="vintage-card p-10 text-center animate-fade-up">
          <p className="text-error font-medium">{error}</p>
          <button
            onClick={() => setPage(page)}
            className="mt-4 text-sm text-rust font-semibold hover:text-rust-light transition-colors"
          >
            Försök igen
          </button>
        </section>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <section className="vintage-card p-10 text-center animate-fade-up">
          <FyndstigenLogo
            size={56}
            className="text-espresso/20 mx-auto mb-4"
          />
          <h2 className="font-display text-xl font-bold">
            Inga loppisar ännu
          </h2>
          <p className="text-espresso/65 mt-2 max-w-sm mx-auto">
            När arrangörer börjar publicera loppisar kommer de dyka upp här.
            Fyndstigen håller utkik!
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
              <p className="text-sm text-espresso/65 mt-1">
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
                  <p className="text-sm text-espresso/65 mt-1.5 flex items-center gap-1.5">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-cream-warm text-espresso hover:bg-mustard/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                &larr; Föregående
              </button>
              <span className="text-sm text-espresso/65">
                Sida {page} av {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-cream-warm text-espresso hover:bg-mustard/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Nästa &rarr;
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Tagline ── */}
      <section className="text-center py-12 animate-fade-up delay-5">
        <p className="font-display text-xl text-espresso/30 italic">
          &ldquo;Varje stig leder till ett fynd&rdquo;
        </p>
      </section>
    </div>
  )
}
