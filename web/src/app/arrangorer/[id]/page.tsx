'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import type { OrganizerProfileView, FleaMarketView } from '@fyndstigen/shared'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useAuth } from '@/lib/auth/auth-context'
import { useDeps } from '@/providers/deps-provider'
import { marketUrl } from '@/lib/urls'

/**
 * Guard user-supplied URLs before they hit an href. The website field is
 * editable from the organizer profile form, so a malicious value like
 * `javascript:alert(1)` would otherwise fire on click. Only http(s) passes.
 */
function safeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export default function OrganizerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { organizers, markets: marketsRepo } = useDeps()
  const [organizer, setOrganizer] = useState<OrganizerProfileView | null>(null)
  const [markets, setMarkets] = useState<FleaMarketView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      organizers.get(id),
      marketsRepo.listByOrganizer(id),
    ])
      .then(([org, mkts]) => {
        setOrganizer(org)
        setMarkets(mkts.filter((m) => m.publishedAt))
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
    // Render the global not-found.tsx UI consistent with the other missing-
    // resource pages. Caveat: because this is a client component the
    // initial SSR response is still 200 — `notFound()` only affects the
    // client render. A real 404 status would require moving the lookup to
    // a server component or a server-side handler. Worth doing if SEO de-
    // indexing of stale organizer IDs matters; for now this avoids the
    // earlier worse outcome (a fully-styled "Arrangören hittades inte" page
    // that looked indexable).
    notFound()
  }

  const name =
    [organizer.firstName, organizer.lastName].filter(Boolean).join(' ') ||
    'Arrangör'
  const isPremium = organizer.subscriptionTier >= 1

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
              <p className="text-espresso/75 mt-2 leading-relaxed">
                {organizer.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-espresso/75">
              {safeHttpUrl(organizer.website) && (
                <a
                  href={organizer.website!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rust hover:text-rust-light transition-colors"
                >
                  {organizer.website!.replace(/^https?:\/\//, '')}
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
                  <p className="text-sm text-espresso/75 mt-0.5">
                    {market.city}
                  </p>
                </div>
                <span
                  className={`stamp text-xs ${market.isPermanent ? 'text-forest' : 'text-mustard'}`}
                >
                  {market.isPermanent ? 'Permanent' : 'Tillfällig'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
