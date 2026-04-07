'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, FleaMarketDetails } from '@/lib/api'
import { KrakanLogo } from '@/components/krakan-logo'

const DAY_NAMES = [
  'Söndag',
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
]

export default function FleaMarketDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [market, setMarket] = useState<FleaMarketDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.fleaMarkets
      .details(id)
      .then(setMarket)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <KrakanLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <KrakanLogo size={56} className="text-espresso/15 mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold">
          Loppisen hittades inte
        </h1>
        <p className="text-espresso/50 mt-2">
          Den kanske har tagits bort eller flyttat.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 text-rust font-medium hover:text-rust-light transition-colors"
        >
          &larr; Tillbaka till utforska
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/40 hover:text-espresso transition-colors duration-200 mb-8"
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
        Tillbaka
      </Link>

      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {market.name}
          </h1>
          <span
            className={`stamp animate-stamp delay-2 ${
              market.is_permanent ? 'text-forest' : 'text-mustard'
            }`}
          >
            {market.is_permanent ? 'Permanent' : 'Tillfällig'}
          </span>
        </div>

        {market.description && (
          <p className="text-espresso/60 text-lg leading-relaxed mt-3 max-w-2xl">
            {market.description}
          </p>
        )}
      </div>

      {/* Info cards */}
      <div className="space-y-4 mt-8">
        {/* Address */}
        <div className="vintage-card p-6 animate-fade-up delay-1">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rust/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-rust"
              >
                <path
                  d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <circle cx="8" cy="6" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-lg mb-1">Adress</h2>
              <p className="text-espresso/70">
                {market.street}, {market.zip_code} {market.city}
              </p>
              {market.country && (
                <p className="text-espresso/40 text-sm mt-0.5">
                  {market.country}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Opening hours */}
        {market.opening_hours?.length > 0 && (
          <div className="vintage-card p-6 animate-fade-up delay-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-forest/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-forest"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 4V8L10.5 10.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-lg mb-3">
                  Öppettider
                </h2>
                <div className="space-y-2">
                  {market.opening_hours.map((oh, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-1.5 border-b border-cream-warm/60 last:border-0"
                    >
                      <span className="text-espresso/60 text-sm">
                        {oh.day_of_week != null
                          ? DAY_NAMES[oh.day_of_week]
                          : oh.date}
                      </span>
                      <span className="font-medium text-sm tabular-nums">
                        {oh.open_time} &ndash; {oh.close_time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Organizer */}
        {market.organizerName && (
          <div className="vintage-card p-6 animate-fade-up delay-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-mustard/15 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-mustard"
                >
                  <circle
                    cx="8"
                    cy="5"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M2 14C2 11.2 4.7 9 8 9s6 2.2 6 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg mb-1">
                  Arrangör
                </h2>
                <p className="text-espresso/70">{market.organizerName}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map link */}
      <div className="mt-8 animate-fade-up delay-4">
        <Link
          href="/map"
          className="inline-flex items-center gap-2 text-sm font-medium text-rust hover:text-rust-light transition-colors"
        >
          Visa på karta &rarr;
        </Link>
      </div>
    </div>
  )
}
