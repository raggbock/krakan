'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FollowButton } from '@/components/follow-button'

type City = {
  slug: string
  canonicalName: string
  marketCount: number
}

type MinCount = 0 | 5 | 10 | 20

const MIN_OPTIONS: { value: MinCount; label: string }[] = [
  { value: 0, label: 'Alla' },
  { value: 5, label: '5+' },
  { value: 10, label: '10+' },
  { value: 20, label: '20+' },
]

/**
 * Filterable, browser-virtualised city list.
 *
 * The page is rendered server-side with the full list (so crawlers and the
 * no-JS path get every city), but on the client this component takes over
 * and lets the visitor narrow by name or minimum market count. Each card
 * is given `content-visibility: auto` + `contain-intrinsic-size` so the
 * browser skips layout/paint for off-screen cards — keeps long lists
 * (493 cities today) snappy without pulling in a virtualisation lib.
 */
export function CitiesFilter({ cities }: { cities: City[] }) {
  const [query, setQuery] = useState('')
  const [minCount, setMinCount] = useState<MinCount>(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cities.filter((c) => {
      if (c.marketCount < minCount) return false
      if (!q) return true
      return (
        c.canonicalName.toLowerCase().includes(q) ||
        c.slug.includes(q)
      )
    })
  }, [cities, query, minCount])

  return (
    <>
      <div className="mt-8 animate-fade-up delay-1">
        <label htmlFor="cities-search" className="sr-only">
          Sök stad
        </label>
        <input
          id="cities-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök stad…"
          className="w-full h-12 rounded-xl bg-card px-4 text-base border border-cream-warm outline-none focus:border-rust/40 focus:shadow-[0_0_0_3px_rgba(196,91,53,0.08)] transition-all placeholder:text-espresso/55"
        />

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrera per antal loppisar">
          {MIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={minCount === opt.value}
              onClick={() => setMinCount(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                minCount === opt.value
                  ? 'bg-rust text-white border-rust'
                  : 'bg-card border-cream-warm text-espresso/75 hover:border-rust/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-espresso/75" aria-live="polite">
          {filtered.length === 0
            ? 'Inga städer matchar filtret.'
            : `${filtered.length} av ${cities.length} städer`}
        </p>
      </div>

      {filtered.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((city) => (
            <li
              key={city.slug}
              className="vintage-card overflow-hidden"
              style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '0 84px',
              }}
            >
              <div className="flex items-center justify-between gap-3 p-4">
                <Link
                  href={`/loppisar/${city.slug}`}
                  className="flex-1 min-w-0 group hover:text-rust transition-colors"
                >
                  <span className="font-display font-bold group-hover:text-rust transition-colors truncate block">
                    {city.canonicalName}
                  </span>
                  <span className="text-sm text-espresso/75 mt-0.5 block">
                    {city.marketCount === 1 ? '1 loppis' : `${city.marketCount} loppisar`}
                  </span>
                </Link>
                <FollowButton kind="city" target={city.slug} source="hub" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
