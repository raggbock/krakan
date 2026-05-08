'use client'

import { useRef, useState } from 'react'
import { useAdminMarketsBulkEdit, useAdminMarketEdit, useAdminMarketsOverview } from '@/hooks/use-admin-markets'
import { useTakeoverSend } from '@/hooks/use-takeover-admin'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { endpoints } from '@/lib/edge/edge'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'
import { marketCompleteness } from '@fyndstigen/shared/domain/market-completeness'
import { EditMarketDrawer } from './edit-market-drawer'
import { bulkGeocode } from './bulk-geocode'
import { runGeocodeSession } from './geocode-session'
import { useMarketCuration, type FilterKey, type SortKey, type SortDir } from '@/hooks/use-market-curation'

const FILTER_GROUPS: { label: string; filters: { key: FilterKey; label: string }[] }[] = [
  {
    label: 'Status',
    filters: [
      { key: 'complete', label: 'Komplett ✓' },
      { key: 'almost_complete', label: 'Nästan komplett' },
      { key: 'unpublished', label: 'Opublicerade' },
      { key: 'system_owned', label: 'System-ägda' },
      { key: 'claimed', label: 'Claimade' },
      { key: 'unverified', label: 'Unverified' },
      { key: 'closed', label: 'Visa stängda' },
      { key: 'published_no_takeover', label: 'Publ. utan takeover' },
    ],
  },
  {
    label: 'Saknar',
    filters: [
      { key: 'missing_street', label: '🛣 gata' },
      { key: 'missing_zip', label: '📮 postnr' },
      { key: 'missing_coords', label: '📍 koord' },
      { key: 'missing_website', label: '🌐 webb' },
      { key: 'missing_phone', label: '📞 tfn' },
      { key: 'missing_email', label: '📧 epost' },
      { key: 'missing_hours', label: '🕐 öppet' },
    ],
  },
  {
    label: 'Har',
    filters: [
      { key: 'has_street', label: '🛣 gata' },
      { key: 'has_zip', label: '📮 postnr' },
      { key: 'has_coords', label: '📍 koord' },
      { key: 'has_website', label: '🌐 webb' },
      { key: 'has_phone', label: '📞 tfn' },
      { key: 'has_email', label: '📧 epost' },
      { key: 'has_hours', label: '🕐 öppet' },
    ],
  },
]

export default function AdminMarketsPage() {
  const { data, isLoading, error } = useAdminMarketsOverview()
  const editMut = useAdminMarketEdit()
  const bulkMut = useAdminMarketsBulkEdit()
  const takeoverMut = useTakeoverSend()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lastTakeoverSummary, setLastTakeoverSummary] = useState<{ sent: number; skipped: number; errors: number } | null>(null)
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number; ok: number; skipped: number } | null>(null)
  const geocodeAbortRef = useRef<AbortController | null>(null)
  const qc = useQueryClient()

  const rows = data?.markets ?? []
  const curation = useMarketCuration(rows)
  const { filtered, counts, selection, activeFilters, sortKey, sortDir, search, setFilter, setSort, setSearch, toggleSelection, selectAll, clearSelection } = curation

  const editingMarket = editingId ? rows.find((m) => m.id === editingId) ?? null : null
  const busy = editMut.isPending || bulkMut.isPending || takeoverMut.isPending

  const selectedTakeoverEligible = rows.filter(
    (m) => selection.has(m.id) && m.isSystemOwned && m.hasEmail && !m.takeover?.used,
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSort(key, sortDir === 'asc' ? 'desc' : 'asc')
    else setSort(key, key === 'updated' ? 'desc' : 'asc')
  }

  async function bulkApply(patch: Parameters<typeof bulkMut.mutateAsync>[0]['patch'], confirmMsg: string) {
    if (selection.size === 0) return
    if (!confirm(`${confirmMsg} ${selection.size} loppisar?`)) return
    try {
      await bulkMut.mutateAsync({ marketIds: Array.from(selection), patch })
      clearSelection()
    } catch { /* surfaced via bulkMut.isError */ }
  }

  async function rowToggle(m: AdminMarketRow, patch: Parameters<typeof editMut.mutateAsync>[0]['patch']) {
    try {
      await editMut.mutateAsync({ marketId: m.id, patch })
    } catch { /* surfaced via editMut.isError */ }
  }

  async function runBulkGeocode() {
    const targets = rows.filter((m) => !m.hasCoordinates && (m.street || m.zipCode || m.city))
    if (targets.length === 0) {
      alert('Inga rader saknar koordinater (eller saknar även adress att slå upp).')
      return
    }
    if (!confirm(`Geocoda ${targets.length} rader via OpenStreetMap? Tar ca ${Math.ceil(targets.length * 1.1)} sekunder.`)) return

    const ctrl = new AbortController()
    geocodeAbortRef.current = ctrl
    setGeocodeProgress({ done: 0, total: targets.length, ok: 0, skipped: 0 })

    try {
      const result = await runGeocodeSession(
        targets,
        (markets, signal) => bulkGeocode(markets, signal),
        (p) => setGeocodeProgress({ done: p.done, total: p.total, ok: p.succeeded, skipped: p.failed }),
        async (id, patch) => {
          await endpoints['admin.market.edit'].invoke({ marketId: id, patch })
        },
        ctrl.signal,
      )
      setGeocodeProgress({ done: result.succeeded + result.failed, total: targets.length, ok: result.succeeded, skipped: result.failed })
    } finally {
      geocodeAbortRef.current = null
      qc.invalidateQueries({ queryKey: queryKeys.admin.marketsOverview() })
    }
  }

  function cancelBulkGeocode() {
    geocodeAbortRef.current?.abort()
  }

  async function sendTakeover(marketIds: string[]) {
    if (marketIds.length === 0) return
    if (!confirm(`Skicka takeover-mail till ${marketIds.length} loppisar?`)) return
    setLastTakeoverSummary(null)
    try {
      const res = await takeoverMut.mutateAsync(marketIds)
      setLastTakeoverSummary(res.summary)
      clearSelection()
    } catch { /* surfaced via takeoverMut.isError */ }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Loppisar</h1>
        <p className="text-espresso/65 mt-1">Översikt av alla loppisar — publicerade, opublicerade, system-ägda och claimade.</p>
      </header>

      {!isLoading && !error && (
        <section className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm">
          <Stat label="Totalt" value={counts.total} />
          <Stat label="Komplett" value={counts.complete} tone="emerald" />
          <Stat label="Opublicerade" value={counts.unpublished} tone="amber" />
          <Stat label="System-ägda" value={counts.systemOwned} tone="amber" />
          <Stat label="Claimade" value={counts.claimed} tone="emerald" />
          <Stat label="Saknar kontakt" value={counts.missingContact} tone="red" />
          <Stat label="Saknar öppettider" value={counts.missingHours} tone="red" />
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök namn, slug eller stad…"
            className="px-3 py-2 rounded-md border border-cream-warm w-72"
          />
          <button
            type="button"
            onClick={() => { FILTER_GROUPS.flatMap((g) => g.filters).forEach((f) => { if (activeFilters.has(f.key)) setFilter(f.key) }) }}
            disabled={activeFilters.size === 0}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${activeFilters.size === 0 ? 'bg-rust text-white border-rust' : 'border-cream-warm text-espresso/75 hover:bg-cream-warm'}`}
          >
            Alla
          </button>
          <button
            type="button"
            onClick={runBulkGeocode}
            disabled={!!geocodeProgress}
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-cream-warm hover:bg-cream-warm disabled:opacity-50"
            title="Slå upp lat/lng via OpenStreetMap för rader som har adress men saknar koord"
          >
            Geocoda saknade ({rows.filter((m) => !m.hasCoordinates && (m.street || m.zipCode || m.city)).length})
          </button>
          <span className="ml-auto text-sm text-espresso/60">
            {filtered.length} av {rows.length}
            {activeFilters.size > 0 && <span className="text-espresso/45"> · {activeFilters.size} filter aktiva</span>}
          </span>
        </div>
        {FILTER_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] uppercase tracking-wide text-espresso/45 w-16">{g.label}</span>
            {g.filters.map((f) => {
              const active = activeFilters.has(f.key)
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${active ? 'bg-rust text-white border-rust' : 'border-cream-warm text-espresso/75 hover:bg-cream-warm'}`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        ))}
      </section>

      {geocodeProgress && (
        <section className="border border-rust/30 bg-rust/5 rounded-md px-3 py-2 flex items-center gap-3 text-sm">
          <span className="font-semibold">Geocoding:</span>
          <span>{geocodeProgress.done}/{geocodeProgress.total}</span>
          <span className="text-emerald-700">{geocodeProgress.ok} klara</span>
          {geocodeProgress.skipped > 0 && (
            <span className="text-amber-700">{geocodeProgress.skipped} hoppade över</span>
          )}
          <div className="flex-1 h-2 bg-cream-warm rounded overflow-hidden">
            <div
              className="h-full bg-rust transition-all"
              style={{ width: `${(geocodeProgress.done / geocodeProgress.total) * 100}%` }}
            />
          </div>
          {geocodeProgress.done < geocodeProgress.total ? (
            <button onClick={cancelBulkGeocode} className="text-xs underline text-espresso/70">Avbryt</button>
          ) : (
            <button onClick={() => setGeocodeProgress(null)} className="text-xs underline text-espresso/70">Stäng</button>
          )}
        </section>
      )}

      {isLoading && <p className="text-espresso/60">Laddar…</p>}
      {error && <p className="text-red-700 text-sm">Kunde inte hämta: {String(error)}</p>}

      {selection.size > 0 && (
        <section className="sticky top-2 z-10 flex flex-wrap items-center gap-2 px-4 py-2 bg-rust text-white rounded-md shadow">
          <span className="text-sm font-semibold">{selection.size} valda</span>
          <div className="flex flex-wrap gap-1 ml-2">
            <BulkBtn onClick={() => bulkApply({ publish: true }, 'Publicera')}>Publicera</BulkBtn>
            <BulkBtn onClick={() => bulkApply({ publish: false }, 'Avpublicera')}>Avpublicera</BulkBtn>
            <BulkBtn onClick={() => bulkApply({ status: 'closed' }, 'Markera som stängda:')}>Stäng</BulkBtn>
            <BulkBtn onClick={() => bulkApply({ status: 'confirmed' }, 'Återöppna')}>Återöppna</BulkBtn>
            <BulkBtn
              onClick={() => sendTakeover(selectedTakeoverEligible.map((m) => m.id))}
              disabled={selectedTakeoverEligible.length === 0}
            >
              Skicka takeover ({selectedTakeoverEligible.length})
            </BulkBtn>
          </div>
          <button onClick={clearSelection} className="ml-auto text-xs underline">
            Avmarkera alla
          </button>
        </section>
      )}

      {lastTakeoverSummary && (
        <section className="text-sm bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex items-center gap-3">
          <span className="font-semibold text-emerald-900">Takeover-utskick klart:</span>
          <span>{lastTakeoverSummary.sent} skickade</span>
          {lastTakeoverSummary.skipped > 0 && <span className="text-amber-800">{lastTakeoverSummary.skipped} hoppade över</span>}
          {lastTakeoverSummary.errors > 0 && <span className="text-red-700">{lastTakeoverSummary.errors} fel</span>}
          <button onClick={() => setLastTakeoverSummary(null)} className="ml-auto text-xs text-emerald-900/60 hover:text-emerald-900">✕</button>
        </section>
      )}

      {!isLoading && !error && (
        <section className="border border-cream-warm rounded-md bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-warm/40 text-espresso/70 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((m) => selection.has(m.id))}
                    onChange={(e) => {
                      if (e.target.checked) selectAll()
                      else filtered.forEach((m) => toggleSelection(m.id, false))
                    }}
                    aria-label="Välj alla synliga"
                  />
                </th>
                <SortHeader label="Namn" colKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Stad" colKey="city" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Status" colKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2">Saknad info</th>
                <th className="text-left px-3 py-2">Takeover</th>
                <SortHeader label="Uppdaterad" colKey="updated" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <MarketRow
                  key={m.id}
                  market={m}
                  selected={selection.has(m.id)}
                  busy={busy}
                  onSelect={(on) => toggleSelection(m.id, on)}
                  onEdit={() => setEditingId(m.id)}
                  onTogglePublish={() => rowToggle(m, { publish: !m.isPublished })}
                  onToggleClosed={() => rowToggle(m, { status: m.status === 'closed' ? 'confirmed' : 'closed' })}
                  onSendTakeover={() => sendTakeover([m.id])}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-espresso/50">Inga loppisar matchar filtret.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {editingMarket && (
        <EditMarketDrawer
          market={editingMarket}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

function MarketRow({
  market: m, selected, busy, onSelect, onEdit, onTogglePublish, onToggleClosed, onSendTakeover,
}: {
  market: AdminMarketRow
  selected: boolean
  busy: boolean
  onSelect: (on: boolean) => void
  onEdit: () => void
  onTogglePublish: () => void
  onToggleClosed: () => void
  onSendTakeover: () => void
}) {
  const canSendTakeover = m.isSystemOwned && m.hasEmail && !m.takeover?.used
  return (
    <tr className={`border-t border-cream-warm/60 align-top ${selected ? 'bg-rust/5' : ''}`}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Välj ${m.name}`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{m.name}</span>
          {m.contactWebsite && (
            <a
              href={m.contactWebsite}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-rust hover:underline"
              title={m.contactWebsite}
              onClick={(e) => e.stopPropagation()}
            >
              webbplats ↗
            </a>
          )}
        </div>
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
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onEdit}
            className="text-rust hover:underline text-xs font-semibold"
          >
            Redigera →
          </button>
          <button
            onClick={onTogglePublish}
            disabled={busy}
            className="text-xs text-espresso/60 hover:text-espresso disabled:opacity-50"
          >
            {m.isPublished ? 'Avpublicera' : 'Publicera'}
          </button>
          <button
            onClick={onToggleClosed}
            disabled={busy}
            className="text-xs text-espresso/60 hover:text-espresso disabled:opacity-50"
          >
            {m.status === 'closed' ? 'Återöppna' : 'Stäng'}
          </button>
          {canSendTakeover && (
            <button
              onClick={onSendTakeover}
              disabled={busy}
              className="text-xs text-rust hover:underline disabled:opacity-50"
              title={m.takeover?.hasActiveToken ? 'Skicka om — invaliderar befintlig token' : 'Skicka takeover-mail'}
            >
              {m.takeover?.hasActiveToken ? 'Skicka om' : 'Skicka takeover'}
            </button>
          )}
          {m.isSystemOwned && !m.hasEmail && (
            <span className="text-xs text-espresso/40" title="Saknar contact_email">📧 saknas</span>
          )}
        </div>
      </td>
    </tr>
  )
}

function SortHeader({
  label, colKey, sortKey, sortDir, onSort,
}: {
  label: string
  colKey: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = sortKey === colKey
  const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th className="text-left px-3 py-2">
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={`uppercase tracking-wide text-xs hover:text-espresso ${active ? 'text-rust font-semibold' : 'text-espresso/70'}`}
      >
        {label}{arrow}
      </button>
    </th>
  )
}

function BulkBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function MissingBadges({ m }: { m: AdminMarketRow }) {
  const { missingFields } = marketCompleteness(m)

  if (missingFields.length === 0) {
    return <span className="text-emerald-700 text-xs font-semibold">✓ allt</span>
  }

  const labels: Record<string, { label: string; key: string }[]> = {
    address: [
      ...(!m.street ? [{ label: '🛣 gata', key: 'street' }] : []),
      ...(!m.zipCode ? [{ label: '📮 postnr', key: 'zip' }] : []),
    ],
    lat_lng: [{ label: '📍 koord', key: 'geo' }],
    opening_hours: [{ label: '🕐 öppet', key: 'hours' }],
    organizer: [
      ...(!m.hasWebsite ? [{ label: '🌐 webb', key: 'web' }] : []),
      ...(!m.hasPhone ? [{ label: '📞 tfn', key: 'phone' }] : []),
      ...(!m.hasEmail ? [{ label: '📧 epost', key: 'email' }] : []),
    ],
  }

  const badges = missingFields.flatMap((f) => labels[f] ?? [])

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((x) => (
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
