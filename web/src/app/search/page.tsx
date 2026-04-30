'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { getInitials } from '@fyndstigen/shared'
import { useSearch } from '@/hooks/use-search'
import { marketUrl } from '@/lib/urls'
import { supabase } from '@/lib/supabase'

type BlockSaleResult = {
  id: string
  slug: string
  name: string
  city: string
  start_date: string
  end_date: string
}

type ActiveFilter = 'all' | 'markets' | 'block_sales'

export default function SearchPage() {
  const posthog = usePostHog()
  const { query, results, loading, search } = useSearch()
  const lastTrackedQuery = useRef<string | null>(null)
  const [blockSaleResults, setBlockSaleResults] = useState<BlockSaleResult[] | null>(null)
  const [blockSalesLoading, setBlockSalesLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')

  // Fire market_search_performed after results arrive (search hook debounces 300ms).
  // Skip if we already fired for this query string.
  useEffect(() => {
    if (!results || loading) return
    if (query.trim() === '') return
    if (lastTrackedQuery.current === query) return
    lastTrackedQuery.current = query
    posthog?.capture('market_search_performed', {
      query_length: query.trim().length,
      has_results: results.length > 0,
      result_count: results.length,
    })
  }, [results, loading, query, posthog])

  // Parallel block_sale search — text-match on name and city
  useEffect(() => {
    if (!query.trim()) {
      setBlockSaleResults(null)
      return
    }
    const q = query.trim()
    const timer = setTimeout(async () => {
      setBlockSalesLoading(true)
      try {
        const today = new Date().toISOString().slice(0, 10)
        const { data } = await supabase
          .from('block_sales')
          .select('id, slug, name, city, start_date, end_date')
          .eq('is_deleted', false)
          .not('published_at', 'is', null)
          .gte('end_date', today)
          .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
          .order('start_date', { ascending: true })
          .limit(20)
        setBlockSaleResults((data as unknown as BlockSaleResult[]) ?? [])
      } finally {
        setBlockSalesLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold">Sök loppisar</h1>
        <p className="text-espresso/65 mt-2">
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
      {(loading || blockSalesLoading) && (
        <div className="flex justify-center py-16">
          <FyndstigenLogo size={36} className="text-rust animate-bob" />
        </div>
      )}

      {/* Filter chips — shown once we have any results */}
      {(results || blockSaleResults) && !loading && !blockSalesLoading && (
        <div className="flex gap-2 mt-6 flex-wrap">
          {(
            [
              ['all', 'Alla'],
              ['markets', 'Bara butiker'],
              ['block_sales', 'Bara kvartersloppis'],
            ] as [ActiveFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeFilter === value
                  ? 'bg-rust text-white border-rust'
                  : 'bg-card border-cream-warm text-espresso/70 hover:border-rust/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {(results || blockSaleResults) && !loading && !blockSalesLoading && (
        <div className="mt-4 animate-fade-up">
          {/* Flea market results */}
          {activeFilter !== 'block_sales' && results && results.length > 0 && (
            <div className="space-y-3 mb-6">
              {results.map((market, i) => (
                <Link
                  key={market.id}
                  href={marketUrl(market)}
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
                    <p className="text-sm text-espresso/65 mt-0.5">
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
          )}

          {/* Block sale results */}
          {activeFilter !== 'markets' && blockSaleResults && blockSaleResults.length > 0 && (
            <div className="space-y-3">
              {blockSaleResults.map((bs, i) => (
                <Link
                  key={bs.id}
                  href={`/kvartersloppis/${bs.slug}`}
                  className="group flex items-center gap-4 vintage-card p-4 hover:shadow-md transition-all duration-300 animate-fade-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Lilac house avatar */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#ede9fe' }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                      <path d="M4 14L14 4l10 10" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 12v10a1 1 0 001 1h4v-5h6v5h4a1 1 0 001-1V12" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold group-hover:text-[#7c3aed] transition-colors duration-200">
                      {bs.name}
                    </h3>
                    <p className="text-sm text-espresso/65 mt-0.5">
                      {bs.city} · {bs.start_date}{bs.end_date !== bs.start_date ? `–${bs.end_date}` : ''}
                    </p>
                  </div>

                  {/* Type & arrow */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="stamp text-xs hidden sm:inline-flex text-[#7c3aed]">
                      Kvartersloppis
                    </span>
                    <span className="text-espresso/20 group-hover:text-[#7c3aed]/40 transition-colors text-lg">
                      &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Empty state */}
          {(activeFilter === 'all' ? (results?.length ?? 0) + (blockSaleResults?.length ?? 0) : activeFilter === 'markets' ? (results?.length ?? 0) : (blockSaleResults?.length ?? 0)) === 0 && (
            <div className="text-center py-16">
              <FyndstigenLogo
                size={48}
                className="text-espresso/15 mx-auto mb-3"
              />
              <p className="text-espresso/60 font-medium">
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
      {!results && !blockSaleResults && !loading && !blockSalesLoading && (
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
