'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useFollowMarket, useFollowCity } from '@/hooks/use-follows'

export type FollowedMarket = {
  id: string
  name: string
  slug: string
}

export type FollowedCity = {
  slug: string
  displayName: string
}

type Props = {
  userId: string
  markets: FollowedMarket[]
  cities: FollowedCity[]
}

export function FoljerClient({ userId, markets, cities }: Props) {
  const isEmpty = markets.length === 0 && cities.length === 0

  return (
    <>
      {/* Back link */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/75 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka till profil
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Mina följda</h1>
        <p className="text-sm text-espresso/75 mt-0.5">
          Loppisar och städer du följer.
        </p>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="vintage-card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-cream-warm flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-espresso/30">
              <path
                d="M10 2.5C10 2.5 3 7 3 11.5C3 13.985 5.015 16 7.5 16C8.75 16 9.875 15.475 10 15.25C10.125 15.475 11.25 16 12.5 16C14.985 16 17 13.985 17 11.5C17 7 10 2.5 10 2.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold mb-2">Du följer ingenting ännu</h2>
          <p className="text-sm text-espresso/75 max-w-xs mx-auto">
            Du följer inga loppisar eller städer än. Klicka på &quot;Följ&quot; eller &quot;Bevaka&quot; när du hittar något du gillar.
          </p>
          <Link
            href="/utforska"
            className="inline-block mt-5 text-sm font-semibold text-rust hover:text-rust-light transition-colors"
          >
            Utforska loppisar &rarr;
          </Link>
        </div>
      )}

      {/* Followed markets */}
      {markets.length > 0 && (
        <div className="vintage-card overflow-hidden mb-6">
          <div className="px-6 pt-5 pb-3 border-b border-cream-warm">
            <h2 className="font-display text-lg font-bold">Loppisar du följer</h2>
            <p className="text-sm text-espresso/75 mt-0.5">
              {markets.length} {markets.length === 1 ? 'loppis' : 'loppisar'}
            </p>
          </div>
          <ul className="divide-y divide-cream-warm">
            {markets.map((market) => (
              <MarketRow
                key={market.id}
                market={market}
                userId={userId}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Followed cities */}
      {cities.length > 0 && (
        <div className="vintage-card overflow-hidden mb-6">
          <div className="px-6 pt-5 pb-3 border-b border-cream-warm">
            <h2 className="font-display text-lg font-bold">Städer du bevakar</h2>
            <p className="text-sm text-espresso/75 mt-0.5">
              {cities.length} {cities.length === 1 ? 'stad' : 'städer'}
            </p>
          </div>
          <ul className="divide-y divide-cream-warm">
            {cities.map((city) => (
              <CityRow
                key={city.slug}
                city={city}
                userId={userId}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ─── Market row ───────────────────────────────────────────────────────────────

function MarketRow({ market, userId }: { market: FollowedMarket; userId: string }) {
  const posthog = usePostHog()
  const router = useRouter()
  const { unfollow } = useFollowMarket(userId, market.id)

  function handleUnfollow() {
    unfollow.mutate(undefined, {
      onSuccess: () => {
        posthog?.capture('market_unfollowed', { market_id: market.id, source: 'profile_foljer' })
        router.refresh()
      },
    })
  }

  return (
    <li className="flex items-center justify-between px-5 py-4 gap-4">
      <Link
        href={`/loppis/${market.slug}`}
        className="flex items-center gap-3 group flex-1 min-w-0"
      >
        <div className="w-9 h-9 rounded-lg bg-rust/10 flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" className="text-rust">
            <path d="M7.5 13.5C7.5 13.5 1 9 1 4.5C1 2.567 2.567 1 4.5 1C5.632 1 6.643 1.54 7.5 2.5C8.357 1.54 9.368 1 10.5 1C12.433 1 14 2.567 14 4.5C14 9 7.5 13.5 7.5 13.5Z" />
          </svg>
        </div>
        <span className="font-medium text-sm group-hover:text-rust transition-colors truncate">
          {market.name}
        </span>
      </Link>
      <button
        type="button"
        onClick={handleUnfollow}
        disabled={unfollow.isPending}
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cream-warm text-espresso/70 hover:bg-espresso/10 hover:text-espresso transition-colors disabled:opacity-50"
        aria-label={`Avfölj ${market.name}`}
      >
        {unfollow.isPending ? (
          <FyndstigenLogo size={12} className="text-espresso/40 animate-bob" />
        ) : null}
        Avfölj
      </button>
    </li>
  )
}

// ─── City row ─────────────────────────────────────────────────────────────────

function CityRow({ city, userId }: { city: FollowedCity; userId: string }) {
  const posthog = usePostHog()
  const router = useRouter()
  const { unfollow } = useFollowCity(userId, city.slug)

  function handleUnfollow() {
    unfollow.mutate(undefined, {
      onSuccess: () => {
        posthog?.capture('city_unfollowed', { city_slug: city.slug, source: 'profile_foljer' })
        router.refresh()
      },
    })
  }

  return (
    <li className="flex items-center justify-between px-5 py-4 gap-4">
      <Link
        href={`/loppisar/${city.slug}`}
        className="flex items-center gap-3 group flex-1 min-w-0"
      >
        <div className="w-9 h-9 rounded-lg bg-forest/10 flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" className="text-forest">
            <path d="M3 1.5h9a1 1 0 011 1v10.5L7.5 10 2 13.5V2.5a1 1 0 011-1z" />
          </svg>
        </div>
        <span className="font-medium text-sm group-hover:text-forest transition-colors truncate">
          {city.displayName}
        </span>
      </Link>
      <button
        type="button"
        onClick={handleUnfollow}
        disabled={unfollow.isPending}
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cream-warm text-espresso/70 hover:bg-espresso/10 hover:text-espresso transition-colors disabled:opacity-50"
        aria-label={`Sluta bevaka ${city.displayName}`}
      >
        {unfollow.isPending ? (
          <FyndstigenLogo size={12} className="text-espresso/40 animate-bob" />
        ) : null}
        Sluta bevaka
      </button>
    </li>
  )
}
