'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { PopularRoute } from '@fyndstigen/shared'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function RoutesDiscoveryPage() {
  const [routes, setRoutes] = useState<PopularRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.routes
      .listPopular({ latitude: 59.27, longitude: 15.21, radiusKm: 60 })
      .then(setRoutes)
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold">Loppisrundor</h1>
          <p className="text-espresso/65 mt-1">
            Upptäck populära rundor nära dig.
          </p>
        </div>
        <Link
          href="/rundor/skapa"
          className="inline-flex items-center gap-2 bg-rust text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line
              x1="7" y1="1" x2="7" y2="13"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            />
            <line
              x1="1" y1="7" x2="13" y2="7"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            />
          </svg>
          Skapa runda
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <FyndstigenLogo size={40} className="text-rust animate-bob" />
        </div>
      )}

      {!loading && routes.length === 0 && (
        <div className="vintage-card p-10 text-center animate-fade-up">
          <FyndstigenLogo size={48} className="text-espresso/15 mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold">
            Inga rundor publicerade ännu
          </h2>
          <p className="text-sm text-espresso/60 mt-2 max-w-sm mx-auto">
            Bli först med att skapa och dela en loppisrunda!
          </p>
          <Link
            href="/rundor/skapa"
            className="inline-block mt-5 bg-rust text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors"
          >
            Skapa din första runda
          </Link>
        </div>
      )}

      {!loading && routes.length > 0 && (
        <div className="space-y-3">
          {routes.map((route, i) => {
            const creatorName =
              [route.creator_first_name, route.creator_last_name]
                .filter(Boolean)
                .join(' ') || 'Anonym'

            return (
              <Link
                key={route.id}
                href={`/rundor/${route.id}`}
                className="group flex items-center gap-4 vintage-card p-5 hover:shadow-md transition-all animate-fade-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Route icon */}
                <div className="w-12 h-12 rounded-xl bg-rust/10 flex items-center justify-center shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="text-rust"
                  >
                    <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="15" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="8" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M7 6.5L13 7.5M13 10L9.5 14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeDasharray="3 3"
                    />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold group-hover:text-rust transition-colors">
                    {route.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-espresso/60">
                    <span>{route.stop_count} stopp</span>
                    <span>Av {creatorName}</span>
                    {route.planned_date && (
                      <span>
                        {new Date(route.planned_date).toLocaleDateString(
                          'sv-SE',
                          { day: 'numeric', month: 'short' },
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-espresso/20 group-hover:text-rust/40 transition-colors text-lg">
                  &rarr;
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
