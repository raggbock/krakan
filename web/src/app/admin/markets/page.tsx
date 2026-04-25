'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAdminMarketsOverview } from '@/hooks/use-admin-markets'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'

type Filter = 'all' | 'unpublished' | 'system_owned' | 'claimed' | 'missing_contact' | 'missing_hours' | 'unverified'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'unpublished', label: 'Opublicerade' },
  { key: 'system_owned', label: 'Ej claimade (system-ägda)' },
  { key: 'claimed', label: 'Claimade' },
  { key: 'missing_contact', label: 'Saknar kontakt' },
  { key: 'missing_hours', label: 'Saknar öppettider' },
  { key: 'unverified', label: 'Status: unverified' },
]

export default function AdminMarketsPage() {
  const { data, isLoading, error } = useAdminMarketsOverview()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const rows = data?.markets ?? []

  const filtered = useMemo(() => {
    let r = rows
    if (filter === 'unpublished') r = r.filter((m) => !m.isPublished)
    if (filter === 'system_owned') r = r.filter((m) => m.isSystemOwned)
    if (filter === 'claimed') r = r.filter((m) => !m.isSystemOwned)
    if (filter === 'missing_contact') r = r.filter((m) => !m.hasWebsite && !m.hasPhone && !m.hasEmail)
    if (filter === 'missing_hours') r = r.filter((m) => !m.hasOpeningHours)
    if (filter === 'unverified') r = r.filter((m) => m.status === 'unverified')
    const q = search.trim().toLowerCase()
    if (q) {
      r = r.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        (m.slug ?? '').toLowerCase().includes(q) ||
        (m.city ?? '').toLowerCase().includes(q),
      )
    }
    return r
  }, [rows, filter, search])

  const counts = useMemo(() => ({
    total: rows.length,
    unpublished: rows.filter((m) => !m.isPublished).length,
    systemOwned: rows.filter((m) => m.isSystemOwned).length,
    claimed: rows.filter((m) => !m.isSystemOwned).length,
    missingContact: rows.filter((m) => !m.hasWebsite && !m.hasPhone && !m.hasEmail).length,
    missingHours: rows.filter((m) => !m.hasOpeningHours).length,
  }), [rows])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Loppisar</h1>
        <p className="text-espresso/65 mt-1">Översikt av alla loppisar — publicerade, opublicerade, system-ägda och claimade.</p>
      </header>

      {!isLoading && !error && (
        <section className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <Stat label="Totalt" value={counts.total} />
          <Stat label="Opublicerade" value={counts.unpublished} tone="amber" />
          <Stat label="System-ägda" value={counts.systemOwned} tone="amber" />
          <Stat label="Claimade" value={counts.claimed} tone="emerald" />
          <Stat label="Saknar kontakt" value={counts.missingContact} tone="red" />
          <Stat label="Saknar öppettider" value={counts.missingHours} tone="red" />
        </section>
      )}

      <section className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök namn, slug eller stad…"
          className="px-3 py-2 rounded-md border border-cream-warm w-72"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${filter === f.key ? 'bg-rust text-white border-rust' : 'border-cream-warm text-espresso/75 hover:bg-cream-warm'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-espresso/60">{filtered.length} av {rows.length}</span>
      </section>

      {isLoading && <p className="text-espresso/60">Laddar…</p>}
      {error && <p className="text-red-700 text-sm">Kunde inte hämta: {String(error)}</p>}

      {!isLoading && !error && (
        <section className="border border-cream-warm rounded-md bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-warm/40 text-espresso/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Namn</th>
                <th className="text-left px-3 py-2">Stad</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Saknad info</th>
                <th className="text-left px-3 py-2">Takeover</th>
                <th className="text-left px-3 py-2">Uppdaterad</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <MarketRow key={m.id} market={m} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-espresso/50">Inga loppisar matchar filtret.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function MarketRow({ market: m }: { market: AdminMarketRow }) {
  return (
    <tr className="border-t border-cream-warm/60 align-top">
      <td className="px-3 py-2">
        <div className="font-semibold">{m.name}</div>
        <div className="font-mono text-xs text-espresso/50">{m.slug ?? '—'}</div>
      </td>
      <td className="px-3 py-2 text-espresso/75">{m.city ?? '—'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {m.isPublished
            ? <Badge tone="emerald">Publicerad</Badge>
            : <Badge tone="amber">Opublicerad</Badge>}
          {m.isSystemOwned
            ? <Badge tone="amber">System</Badge>
            : <Badge tone="emerald">Claimad</Badge>}
          {m.status === 'unverified' && <Badge tone="amber">Unverified</Badge>}
          {m.status === 'closed' && <Badge tone="red">Stängd</Badge>}
          {!m.isPermanent && <Badge tone="cream">Tillfällig</Badge>}
        </div>
      </td>
      <td className="px-3 py-2">
        <MissingBadges m={m} />
      </td>
      <td className="px-3 py-2">
        <TakeoverBadge m={m} />
      </td>
      <td className="px-3 py-2 text-espresso/60 text-xs">
        {m.updatedAt ? new Date(m.updatedAt).toISOString().slice(0, 10) : '—'}
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          href={`/fleamarkets/${m.id}/edit`}
          className="text-rust hover:underline text-xs font-semibold"
        >
          Redigera →
        </Link>
      </td>
    </tr>
  )
}

function MissingBadges({ m }: { m: AdminMarketRow }) {
  const missing: { label: string; key: string }[] = []
  if (!m.hasWebsite) missing.push({ label: '🌐 webb', key: 'web' })
  if (!m.hasPhone) missing.push({ label: '📞 tfn', key: 'phone' })
  if (!m.hasEmail) missing.push({ label: '📧 epost', key: 'email' })
  if (!m.hasOpeningHours) missing.push({ label: '🕐 öppet', key: 'hours' })
  if (!m.hasCoordinates) missing.push({ label: '📍 koord', key: 'geo' })

  if (missing.length === 0) {
    return <span className="text-emerald-700 text-xs font-semibold">✓ allt</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {missing.map((x) => (
        <span key={x.key} className="text-xs bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.5 rounded">
          {x.label}
        </span>
      ))}
    </div>
  )
}

function TakeoverBadge({ m }: { m: AdminMarketRow }) {
  if (!m.takeover) {
    return <span className="text-espresso/40 text-xs">—</span>
  }
  const t = m.takeover
  if (t.used) return <Badge tone="emerald">Accepterad</Badge>
  if (t.hasActiveToken) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge tone="amber">Aktiv token</Badge>
        {t.sentAt && <span className="text-[10px] text-espresso/50">skickat {new Date(t.sentAt).toISOString().slice(0, 10)}</span>}
      </div>
    )
  }
  if (t.expired) return <Badge tone="red">Token utgången</Badge>
  return <Badge tone="cream">Inte skickad</Badge>
}

function Badge({ tone, children }: { tone: 'emerald' | 'amber' | 'red' | 'cream'; children: React.ReactNode }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : tone === 'red'
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-cream-warm text-espresso/75 border-cream-warm'
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'amber' | 'red' }) {
  const cls = tone === 'amber'
    ? 'bg-amber-50 border-amber-200'
    : tone === 'red'
      ? 'bg-red-50 border-red-200'
      : tone === 'emerald'
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-card border-cream-warm'
  return (
    <div className={`border rounded-md px-3 py-2 ${cls}`}>
      <div className="text-xs uppercase tracking-wide text-espresso/55">{label}</div>
      <div className="font-display font-bold text-2xl">{value}</div>
    </div>
  )
}
