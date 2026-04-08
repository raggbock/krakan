'use client'

import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { getInitials } from '@fyndstigen/shared'
import { useSearch } from '@/hooks/use-search'

export default function SearchPage() {
  const { query, results, loading, search } = useSearch()

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Sök loppisar</h1>
        <p className="text-espresso/50 mt-2">
          Hitta loppisar efter namn eller plats.
        </p>
      </div>

      {/* Search input */}
      <div className="relative mt-6 animate-fade-up delay-1">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-espresso/30">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
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
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Skriv namn på en loppis..."
          className="w-full h-14 rounded-2xl bg-card pl-12 pr-5 text-base border border-cream-warm outline-none focus:border-rust/40 focus:shadow-[0_0_0_3px_rgba(196,91,53,0.08)] transition-all duration-200 placeholder:text-espresso/30"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <FyndstigenLogo size={36} className="text-rust animate-bob" />
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="mt-8 animate-fade-up">
          {results.length > 0 ? (
            <>
              <p className="text-sm text-espresso/40 mb-4">
                {results.length} resultat
              </p>
              <div className="space-y-3">
                {results.map((market, i) => (
                  <Link
                    key={market.id}
                    href={`/fleamarkets/${market.id}`}
                    className="group flex items-center gap-4 vintage-card p-4 hover:shadow-md transition-all duration-300 animate-fade-up"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    {/* Initials avatar */}
                    <div className="w-14 h-14 rounded-xl bg-cream-warm knit-bg flex items-center justify-center shrink-0">
                      <span className="font-display text-sm font-bold text-espresso/25">
                        {getInitials(market.name)}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold group-hover:text-rust transition-colors duration-200">
                        {market.name}
                      </h3>
                      <p className="text-sm text-espresso/50 mt-0.5">
                        {market.city}
                      </p>
                    </div>

                    {/* Type & arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`stamp text-xs hidden sm:inline-flex ${
                          market.is_permanent
                            ? 'text-forest'
                            : 'text-mustard'
                        }`}
                      >
                        {market.is_permanent ? 'Permanent' : 'Tillfällig'}
                      </span>
                      <span className="text-espresso/20 group-hover:text-rust/40 transition-colors text-lg">
                        &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <FyndstigenLogo
                size={48}
                className="text-espresso/15 mx-auto mb-3"
              />
              <p className="text-espresso/40 font-medium">
                Inga loppisar hittades
              </p>
              <p className="text-sm text-espresso/30 mt-1">
                Prova ett annat sökord.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {!results && !loading && (
        <div className="text-center py-20 animate-fade-in delay-2">
          <FyndstigenLogo
            size={56}
            className="text-espresso/8 mx-auto mb-4"
          />
          <p className="text-espresso/30 text-sm">
            Börja skriva för att söka bland loppisar.
          </p>
        </div>
      )}
    </div>
  )
}
