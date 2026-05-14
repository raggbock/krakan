'use client'

import { useMemo, useState } from 'react'
import type { FleaMarketNearByView } from '@fyndstigen/shared'
import type { RouteBuilderStop } from './stop-list'

type Props = {
  markets: FleaMarketNearByView[] | undefined
  stops: RouteBuilderStop[]
  userPos: { lat: number; lng: number } | null
  onAdd: (marketId: string) => void
}

const VISIBLE_COUNT = 6

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/**
 * Keyboard-accessible alternative to clicking markers on the map.
 *
 * Renders a search box plus a short list of nearby (or query-matched) markets
 * with a "Lägg till"-button per row. Filters out markets already in the
 * current route so the same stop can't be added twice.
 *
 * Sorted by distance from the user when geolocation is available, otherwise
 * alphabetical so the list is deterministic.
 */
export function NearbyMarketsList({ markets, stops, userPos, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const inRoute = useMemo(() => new Set(stops.map((s) => s.market.id)), [stops])

  const candidates = useMemo(() => {
    if (!markets) return []
    const q = query.trim().toLowerCase()
    const filtered = markets.filter((m) => {
      if (inRoute.has(m.id)) return false
      if (!q) return true
      return (
        m.name.toLowerCase().includes(q) ||
        (m.city ?? '').toLowerCase().includes(q)
      )
    })
    if (userPos) {
      return [...filtered].sort(
        (a, b) =>
          haversineKm(userPos, { lat: a.latitude, lng: a.longitude }) -
          haversineKm(userPos, { lat: b.latitude, lng: b.longitude }),
      )
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [markets, query, inRoute, userPos])

  if (!markets || markets.length === 0) return null

  const visible = showAll ? candidates : candidates.slice(0, VISIBLE_COUNT)
  const hiddenCount = candidates.length - visible.length

  return (
    <section className="mt-6">
      <h2 className="font-display font-bold text-base mb-2">
        {userPos ? 'Loppisar nära dig' : 'Loppisar'}
      </h2>
      <label htmlFor="route-builder-nearby-search" className="sr-only">
        Sök loppis
      </label>
      <input
        id="route-builder-nearby-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowAll(false)
        }}
        placeholder="Sök loppis…"
        className="w-full h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/55"
      />

      {candidates.length === 0 ? (
        <p className="text-sm text-espresso/75 mt-3">
          {query
            ? 'Inga loppisar matchar sökningen.'
            : 'Alla närliggande loppisar är redan tillagda.'}
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {visible.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onAdd(m.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-cream-warm/60 focus:bg-cream-warm focus:outline-none transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-espresso truncate">
                    {m.name}
                  </span>
                  {m.city && (
                    <span className="block text-xs text-espresso/75 truncate">
                      {m.city}
                      {userPos && (
                        <>
                          {' · '}
                          {haversineKm(userPos, {
                            lat: m.latitude,
                            lng: m.longitude,
                          }).toFixed(1)}{' '}
                          km
                        </>
                      )}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-rust text-white text-base font-bold"
                >
                  +
                </span>
                <span className="sr-only">Lägg till {m.name} i rundan</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs font-semibold text-rust hover:text-rust-light transition-colors"
        >
          Visa {hiddenCount} till
        </button>
      )}
    </section>
  )
}
