'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useOrganizerStats } from '@/hooks/use-organizer-stats'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { features } from '@/lib/feature-flags'

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="vintage-card p-5">
      <p className="text-sm text-espresso/60 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-espresso/45 mt-1">Totalt: {subValue}</p>}
    </div>
  )
}

function LockedStatCard({ label }: { label: string }) {
  return (
    <div className="vintage-card p-5 relative overflow-hidden">
      <p className="text-sm text-espresso/60 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-espresso/15">—</p>
      <div className="absolute inset-0 flex items-center justify-center bg-parchment/80">
        <div className="text-center px-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto mb-1.5 text-espresso/30">
            <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-xs font-medium text-espresso/50">Skyltfönstret</p>
        </div>
      </div>
    </div>
  )
}

export default function OrganizerStatsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { markets, totals, loading, error } = useOrganizerStats(user?.id === id ? id : undefined)
  const [isPremium, setIsPremium] = useState(false)
  const [tierLoading, setTierLoading] = useState(true)

  const [upgradeLoading, setUpgradeLoading] = useState(false)

  async function handleUpgrade() {
    setUpgradeLoading(true)
    try {
      const data = await api.edge.invoke<{ url?: string }>('skyltfonstret-checkout')
      if (!data?.url) throw new Error('Failed to create checkout')
      window.location.href = data.url
    } catch {
      setUpgradeLoading(false)
    }
  }

  useEffect(() => {
    if (!features.skyltfonstret) {
      setIsPremium(false)
      setTierLoading(false)
      return
    }
    if (!id) return
    api.organizers.get(id)
      .then((org) => setIsPremium((org?.subscription_tier ?? 0) >= 1))
      .catch(() => setIsPremium(false))
      .finally(() => setTierLoading(false))
  }, [id])

  useEffect(() => {
    if (!authLoading && (!user || user.id !== id)) {
      router.replace(`/arrangorer/${id}`)
    }
  }, [authLoading, user, id, router])

  if (authLoading || loading || tierLoading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!user || user.id !== id) return null

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="vintage-card p-6 text-center">
          <p className="text-espresso/60">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <Link href={`/arrangorer/${id}`} className="text-sm text-rust hover:text-rust-light transition-colors">
            &larr; Tillbaka till profil
          </Link>
          <h1 className="font-display text-2xl font-bold mt-2">Statistik</h1>
          <p className="text-sm text-espresso/60 mt-1">Senaste 30 dagarna</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up delay-1">
        {isPremium && (
          <StatCard
            label="Sidvisningar"
            value={totals.pageviews_30d.toLocaleString('sv-SE')}
            subValue={totals.pageviews_total.toLocaleString('sv-SE')}
          />
        )}
        {features.skyltfonstret && !isPremium && (
          <LockedStatCard label="Sidvisningar" />
        )}
        <StatCard
          label="Bokningar"
          value={totals.bookings_30d.toLocaleString('sv-SE')}
          subValue={totals.bookings_total.toLocaleString('sv-SE')}
        />
        <StatCard
          label="Intäkter"
          value={`${totals.revenue_30d_sek.toLocaleString('sv-SE')} kr`}
          subValue={`${totals.revenue_total_sek.toLocaleString('sv-SE')} kr`}
        />
        <StatCard
          label="I rundor"
          value={totals.route_count_30d.toLocaleString('sv-SE')}
          subValue={totals.route_count_total.toLocaleString('sv-SE')}
        />
      </div>

      {/* Conversion — premium only */}
      {isPremium && totals.conversion_30d > 0 && (
        <div className="vintage-card p-5 mb-8 animate-fade-up delay-2">
          <p className="text-sm text-espresso/60 mb-1">Konvertering (besök till bokning)</p>
          <p className="font-display text-2xl font-bold">{totals.conversion_30d}%</p>
        </div>
      )}

      {features.skyltfonstret && !isPremium && (
        <div className="vintage-card p-5 mb-8 relative overflow-hidden animate-fade-up delay-2">
          <p className="text-sm text-espresso/60 mb-1">Konvertering (besök till bokning)</p>
          <p className="font-display text-2xl font-bold text-espresso/15">—</p>
          <div className="absolute inset-0 flex items-center justify-center bg-parchment/80">
            <div className="text-center px-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto mb-1.5 text-espresso/30">
                <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium text-espresso/50">Skyltfönstret</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-market breakdown — premium only */}
      {isPremium && markets.length > 1 && (
        <div className="animate-fade-up delay-3">
          <h2 className="font-display text-xl font-bold mb-4">Per loppis</h2>
          <div className="vintage-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-espresso/10">
                    <th className="text-left p-4 font-medium text-espresso/60">Loppis</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Visningar</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Bokningar</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Intäkter</th>
                    <th className="text-right p-4 font-medium text-espresso/60">I rundor</th>
                    <th className="text-right p-4 font-medium text-espresso/60">Konv.</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((market) => (
                    <tr key={market.flea_market_id} className="border-b border-espresso/5 last:border-0">
                      <td className="p-4 font-medium">
                        <Link href={`/fleamarkets/${market.flea_market_id}`} className="text-rust hover:text-rust-light transition-colors">
                          {market.name}
                        </Link>
                      </td>
                      <td className="text-right p-4">{market.pageviews_30d.toLocaleString('sv-SE')}</td>
                      <td className="text-right p-4">{(market.bookings_30d.confirmed + market.bookings_30d.pending).toLocaleString('sv-SE')}</td>
                      <td className="text-right p-4">{market.revenue_30d_sek.toLocaleString('sv-SE')} kr</td>
                      <td className="text-right p-4">{market.route_count_30d.toLocaleString('sv-SE')}</td>
                      <td className="text-right p-4">{market.conversion_30d > 0 ? `${market.conversion_30d}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!isPremium && markets.length > 1 && (
        <div className="vintage-card p-8 text-center animate-fade-up delay-3">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="mx-auto mb-2 text-espresso/30">
            <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="font-display font-bold mb-1">Detaljerad statistik per loppis</p>
          <p className="text-sm text-espresso/60">Uppgradera till Skyltfönstret för att se visningar, konvertering och mer per loppis.</p>
        </div>
      )}

      {/* Skyltfönstret upsell banner for free tier */}
      {features.skyltfonstret && !isPremium && (
        <div className="vintage-card p-6 mt-8 bg-mustard/5 border-mustard/20 animate-fade-up delay-4">
          <h3 className="font-display font-bold text-lg mb-2">Skyltfönstret</h3>
          <p className="text-sm text-espresso/70 mb-3">
            Ställ ut din loppis i Skyltfönstret och få tillgång till egen SEO, detaljerad statistik och mer synlighet.
          </p>
          <ul className="text-sm text-espresso/70 space-y-1 mb-4">
            <li>&#10003; Bättre synlighet på Google</li>
            <li>&#10003; Sidvisningar och konvertering</li>
            <li>&#10003; Statistik per loppis</li>
          </ul>
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="h-11 px-6 rounded-xl bg-mustard text-white font-semibold text-sm hover:bg-mustard/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            {upgradeLoading ? 'Laddar...' : 'Uppgradera — 69 kr/mån'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {markets.length === 0 && (
        <div className="vintage-card p-8 text-center animate-fade-up delay-2">
          <p className="text-espresso/60">Du har inga publicerade loppisar ännu.</p>
          <Link href="/fleamarkets/new" className="text-rust mt-2 inline-block">
            Skapa din första loppis &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
