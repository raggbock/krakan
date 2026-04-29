'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { OrganizerProfile, FleaMarket } from '@fyndstigen/shared'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useAuth } from '@/lib/auth-context'
import { useDeps } from '@/providers/deps-provider'
import { marketUrl } from '@/lib/urls'

export default function OrganizerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { organizers, markets: marketsRepo } = useDeps()
  const [organizer, setOrganizer] = useState<OrganizerProfile | null>(null)
  const [markets, setMarkets] = useState<FleaMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      organizers.get(id),
      marketsRepo.listByOrganizer(id),
    ])
      .then(([org, mkts]) => {
        setOrganizer(org)
        setMarkets(mkts.filter((m) => m.published_at))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, organizers, marketsRepo])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!organizer) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <h1 className="font-display text-2xl font-bold">
          Arrangören hittades inte
        </h1>
        <Link href="/" className="text-rust mt-4 inline-block">
          &larr; Tillbaka
        </Link>
      </div>
    )
  }

  const name =
    [organizer.first_name, organizer.last_name].filter(Boolean).join(' ') ||
    'Arrangör'
  const isPremium = organizer.subscription_tier >= 1

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="vintage-card p-8 animate-fade-up">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-rust/10 flex items-center justify-center shrink-0">
            <span className="font-display text-2xl font-bold text-rust/40">
              {name.charAt(0)}
            </span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold">{name}</h1>
              {isPremium && (
                <span className="stamp text-mustard text-xs animate-stamp">
                  Premium
                </span>
              )}
            </div>

            {organizer.bio && (
              <p className="text-espresso/60 mt-2 leading-relaxed">
                {organizer.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-espresso/60">
              {organizer.website && (
                <a
                  href={organizer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rust hover:text-rust-light transition-colors"
                >
                  {organizer.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span>{markets.length} loppisar</span>
            </div>
          </div>
        </div>
      </div>

      {user?.id === id && (
        <div className="mt-4 animate-fade-up delay-1">
          <Link
            href={`/arrangorer/${id}/statistik`}
            className="inline-flex items-center gap-2 vintage-card px-5 py-3 text-sm font-medium text-rust hover:shadow-md transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-rust">
              <rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
              <rect x="5.5" y="5" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.6" />
              <rect x="10" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.8" />
            </svg>
            Visa statistik
          </Link>
        </div>
      )}

      {/* Markets */}
      {markets.length > 0 && (
        <div className="mt-8 animate-fade-up delay-1">
          <h2 className="font-display text-xl font-bold mb-4">Loppisar</h2>
          <div className="space-y-3">
            {markets.map((market) => (
              <Link
                key={market.id}
                href={marketUrl(market)}
                className="group flex items-center gap-4 vintage-card p-4 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-cream-warm knit-bg flex items-center justify-center shrink-0">
                  <span className="font-display text-sm font-bold text-espresso/20">
                    {market.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold group-hover:text-rust transition-colors">
                    {market.name}
                  </h3>
                  <p className="text-sm text-espresso/65 mt-0.5">
                    {market.city}
                  </p>
                </div>
                <span
                  className={`stamp text-xs ${market.is_permanent ? 'text-forest' : 'text-mustard'}`}
                >
                  {market.is_permanent ? 'Permanent' : 'Tillfällig'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
