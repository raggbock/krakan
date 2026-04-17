'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useOrganizerStats } from '@/hooks/use-organizer-stats'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useEffect } from 'react'

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="vintage-card p-5">
      <p className="text-sm text-espresso/60 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-espresso/45 mt-1">Totalt: {subValue}</p>}
    </div>
  )
}

export default function OrganizerStatsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { markets, totals, loading, error } = useOrganizerStats(user?.id === id ? id : undefined)

  useEffect(() => {
    if (!authLoading && (!user || user.id !== id)) {
      router.replace(`/arrangorer/${id}`)
    }
  }, [authLoading, user, id, router])

  if (authLoading || loading) {
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
        <StatCard
          label="Sidvisningar"
          value={totals.pageviews_30d.toLocaleString('sv-SE')}
          subValue={totals.pageviews_total.toLocaleString('sv-SE')}
        />
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

      {/* Conversion */}
      {totals.conversion_30d > 0 && (
        <div className="vintage-card p-5 mb-8 animate-fade-up delay-2">
          <p className="text-sm text-espresso/60 mb-1">Konvertering (besök till bokning)</p>
          <p className="font-display text-2xl font-bold">{totals.conversion_30d}%</p>
        </div>
      )}

      {/* Per-market breakdown */}
      {markets.length > 1 && (
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
