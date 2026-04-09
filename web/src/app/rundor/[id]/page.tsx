'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { checkOpeningHours, type OpeningHoursEntry, formatDistance, formatDuration, type RoutingResult } from '@fyndstigen/shared'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useRoute } from '@/hooks/use-routes'

const RouteMap = dynamic(() => import('@/components/route-map'), { ssr: false })

export default function RouteViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { route, loading } = useRoute(id)
  const [routing, setRouting] = useState<RoutingResult | null>(null)
  const [routingFailed, setRoutingFailed] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!route) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <FyndstigenLogo size={56} className="text-espresso/15 mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold">
          Rundan hittades inte
        </h1>
        <Link
          href="/"
          className="inline-block mt-6 text-rust font-medium hover:text-rust-light transition-colors"
        >
          &larr; Tillbaka
        </Link>
      </div>
    )
  }

  const validStops = route.stops.filter((s) => s.fleaMarket)

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Back */}
      <Link
        href="/rundor"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M9 3L5 7L9 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Alla rundor
      </Link>

      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-display text-3xl font-bold">{route.name}</h1>
          <span className="stamp text-rust">{validStops.length} stopp</span>
        </div>
        {route.description && (
          <p className="text-espresso/60 mt-2">{route.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-espresso/60 mt-3">
          {route.creatorName && <span>Av {route.creatorName}</span>}
          {route.planned_date && (
            <span>
              Planerad{' '}
              {new Date(route.planned_date).toLocaleDateString('sv-SE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Route summary bar */}
      {routing && (
        <div className="flex flex-wrap items-center gap-4 mt-6 animate-fade-up delay-1">
          <div className="flex items-center gap-2 bg-cream-warm rounded-full px-4 py-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-espresso/60">
              <path d="M1 8h14M8 1v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium">{formatDistance(routing.totalDistance)}</span>
          </div>
          <div className="flex items-center gap-2 bg-cream-warm rounded-full px-4 py-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-espresso/60">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4V8L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium">{formatDuration(routing.totalDuration)} med bil</span>
          </div>
        </div>
      )}

      {routingFailed && !routing && (
        <p className="text-xs text-espresso/60 mt-4">
          Kunde inte beräkna vägbeskrivning. Raka linjer visas istället.
        </p>
      )}

      {/* Map */}
      <div className="mt-6 rounded-2xl overflow-hidden border border-cream-warm h-[400px] animate-fade-up delay-1">
        <RouteMap stops={validStops} onRoutingResult={setRouting} onRoutingError={setRoutingFailed} />
      </div>

      {/* Stops list */}
      <div className="mt-8 animate-fade-up delay-2">
        <h2 className="font-display text-xl font-bold mb-4">Stopp</h2>
        <div className="space-y-0">
          {validStops.map((stop, vi) => {
            const fm = stop.fleaMarket!
            const oh = route.planned_date
              ? checkOpeningHours(
                  (fm.openingHours ?? []) as OpeningHoursEntry[],
                  route.planned_date,
                )
              : null
            const leg = routing?.legs?.[vi - 1]

            return (
              <div key={stop.id}>
                {/* Leg connector (distance between previous stop and this one) */}
                {vi > 0 && leg && (
                  <div className="flex items-center gap-3 py-2 pl-4">
                    <div className="w-8 flex justify-center">
                      <div className="w-px h-6 bg-rust/20" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-espresso/35">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M2 12 L6 4 L10 8 L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{formatDistance(leg.distance)}</span>
                      <span>&middot;</span>
                      <span>{formatDuration(leg.duration)}</span>
                    </div>
                  </div>
                )}

                {/* Stop card */}
                <Link
                  href={`/fleamarkets/${fm.id}`}
                  className="group flex items-center gap-4 vintage-card p-4 hover:shadow-md transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-rust text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {vi + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold group-hover:text-rust transition-colors">
                      {fm.name}
                    </h3>
                    <p className="text-sm text-espresso/65 mt-0.5">
                      {fm.street}, {fm.city}
                    </p>
                  </div>

                  {oh && !oh.isOpen && (
                    <span className="stamp text-error text-xs">Stängt</span>
                  )}
                  {oh && oh.isOpen && oh.hours && (
                    <span className="text-forest text-sm font-medium tabular-nums">
                      {oh.hours.open_time}–{oh.hours.close_time}
                    </span>
                  )}

                  <span
                    className={`stamp text-xs hidden sm:inline-flex ${fm.is_permanent ? 'text-forest' : 'text-mustard'}`}
                  >
                    {fm.is_permanent ? 'Permanent' : 'Tillfällig'}
                  </span>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
