'use client'

import { useState, lazy, Suspense } from 'react'
import { useAdminMarketActivity, useAdminMarketEdit } from '@/hooks/use-admin-markets'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'
import type { AdminActivityRow } from '@fyndstigen/shared/contracts/admin-market-activity'

// Address picker pulls in Leaflet (~100kB) — load only when the user opens
// the map section.
const AddressPicker = lazy(() => import('@/components/address-picker'))

type RuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

const DAY_LABELS: Record<number, string> = {
  1: 'Mån', 2: 'Tis', 3: 'Ons', 4: 'Tor', 5: 'Fre', 6: 'Lör', 0: 'Sön',
}
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function EditMarketDrawer({
  market,
  onClose,
}: {
  market: AdminMarketRow
  onClose: () => void
}) {
  const editMut = useAdminMarketEdit()

  // Contact section
  const [website, setWebsite] = useState(market.contactWebsite ?? '')
  const [facebook, setFacebook] = useState(market.contactFacebook ?? '')
  const [instagram, setInstagram] = useState(market.contactInstagram ?? '')
  const [phone, setPhone] = useState(market.contactPhone ?? '')
  const [email, setEmail] = useState(market.contactEmail ?? '')

  // Address + map
  const [showMap, setShowMap] = useState(false)
  const [street, setStreet] = useState(market.street ?? '')
  const [zipCode, setZipCode] = useState(market.zipCode ?? '')
  const [city, setCity] = useState(market.city ?? '')
  const [latitude, setLatitude] = useState<number | null>(market.latitude)
  const [longitude, setLongitude] = useState<number | null>(market.longitude)

  // Opening hours — weekly only in this drawer (the most common case for
  // permanent shops). Date-anchored rules stay editable on the existing
  // organizer page.
  const initialWeekly = market.openingHourRules
    .filter((r) => r.type === 'weekly' && r.dayOfWeek != null)
    .map((r) => ({
      type: 'weekly' as const,
      dayOfWeek: r.dayOfWeek,
      anchorDate: null,
      openTime: r.openTime.slice(0, 5),
      closeTime: r.closeTime.slice(0, 5),
    }))
  const initialNonWeekly = market.openingHourRules.filter((r) => r.type !== 'weekly' || r.dayOfWeek == null)
  const [weeklyRules, setWeeklyRules] = useState<RuleDraft[]>(initialWeekly)

  function toggleDay(day: number, enabled: boolean) {
    if (enabled) {
      if (weeklyRules.some((r) => r.dayOfWeek === day)) return
      setWeeklyRules([...weeklyRules, {
        type: 'weekly', dayOfWeek: day, anchorDate: null,
        openTime: '10:00', closeTime: '17:00',
      }])
    } else {
      setWeeklyRules(weeklyRules.filter((r) => r.dayOfWeek !== day))
    }
  }

  function updateRule(day: number, field: 'openTime' | 'closeTime', v: string) {
    setWeeklyRules(weeklyRules.map((r) => r.dayOfWeek === day ? { ...r, [field]: v } : r))
  }

  async function save() {
    // Build patch. Only include sections that changed.
    const patch: AdminMarketEditPatch = {}

    const contactChanged =
      website !== (market.contactWebsite ?? '') ||
      facebook !== (market.contactFacebook ?? '') ||
      instagram !== (market.contactInstagram ?? '') ||
      phone !== (market.contactPhone ?? '') ||
      email !== (market.contactEmail ?? '')
    if (contactChanged) {
      patch.contact = {
        website: website || null,
        facebook: facebook || null,
        instagram: instagram || null,
        phone: phone || null,
        email: email || null,
      }
    }

    const addressChanged =
      street !== (market.street ?? '') ||
      zipCode !== (market.zipCode ?? '') ||
      city !== (market.city ?? '')
    if (addressChanged) {
      patch.address = {
        street: street || null,
        zipCode: zipCode || null,
        city: city || null,
      }
    }

    const locationChanged =
      latitude !== market.latitude ||
      longitude !== market.longitude
    if (locationChanged && latitude != null && longitude != null) {
      patch.location = { latitude, longitude }
    }

    // Opening hours: serialize current weekly rules + keep any non-weekly
    // ones from the original (the drawer doesn't edit those). Compare by
    // serialising both sides to a canonical key — the previous Set + every()
    // pair was easy to get subtly wrong (one report of edits not saving).
    const weeklySerialized = weeklyRules
      .filter((r) => r.dayOfWeek != null)
      .map((r) => ({
        type: r.type,
        dayOfWeek: r.dayOfWeek,
        anchorDate: r.anchorDate,
        openTime: r.openTime.length === 5 ? `${r.openTime}:00` : r.openTime,
        closeTime: r.closeTime.length === 5 ? `${r.closeTime}:00` : r.closeTime,
      }))
    const allRules = [
      ...weeklySerialized,
      ...initialNonWeekly.map((r) => ({
        type: r.type,
        dayOfWeek: r.dayOfWeek,
        anchorDate: r.anchorDate,
        openTime: r.openTime,
        closeTime: r.closeTime,
      })),
    ]
    const ruleKey = (r: { dayOfWeek: number | null; openTime: string; closeTime: string }) => {
      const t = (s: string) => s.length === 5 ? `${s}:00` : s
      return `${r.dayOfWeek}|${t(r.openTime)}|${t(r.closeTime)}`
    }
    const originalKeys = initialWeekly.map(ruleKey).sort().join(',')
    const newKeys = weeklySerialized.map(ruleKey).sort().join(',')
    if (originalKeys !== newKeys) {
      patch.openingHourRules = allRules
    }

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }

    await editMut.mutateAsync({ marketId: market.id, patch })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-card overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-card border-b border-cream-warm px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl">{market.name}</h2>
            <p className="text-xs font-mono text-espresso/50">{market.slug ?? market.id}</p>
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-rust hover:underline"
              >
                Öppna webbplats ↗
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-espresso/60 hover:text-espresso px-2 py-1">✕</button>
        </header>

        <div className="p-5 space-y-6">
          {/* Kontakt */}
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base">Kontakt</h3>
            <Field label="Webbplats" value={website} onChange={setWebsite} placeholder="https://..." />
            <Field label="Facebook" value={facebook} onChange={setFacebook} placeholder="https://facebook.com/..." />
            <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="https://instagram.com/..." />
            <Field label="Telefon" value={phone} onChange={setPhone} placeholder="+46..." />
            <Field label="E-post" value={email} onChange={setEmail} type="email" />
          </section>

          {/* Plats */}
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base">Plats</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gata" value={street} onChange={setStreet} />
              <Field label="Postnr" value={zipCode} onChange={setZipCode} />
              <Field label="Stad" value={city} onChange={setCity} />
              <div className="text-xs text-espresso/60 pt-5">
                {latitude != null && longitude != null
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : 'Ingen koordinat satt'}
              </div>
            </div>
            {!showMap ? (
              <button
                onClick={() => setShowMap(true)}
                className="text-sm border border-cream-warm rounded-md px-3 py-2 hover:bg-cream-warm"
              >
                {latitude != null ? 'Justera på karta' : 'Sätt på karta'}
              </button>
            ) : (
              <div className="h-80 border border-cream-warm rounded-md overflow-hidden">
                <Suspense fallback={<div className="h-full grid place-items-center text-espresso/50">Laddar karta…</div>}>
                  <AddressPicker
                    value={{
                      street, zipCode, city,
                      latitude, longitude,
                    }}
                    onChange={(v) => {
                      setStreet(v.street)
                      setZipCode(v.zipCode)
                      setCity(v.city)
                      setLatitude(v.latitude)
                      setLongitude(v.longitude)
                    }}
                  />
                </Suspense>
              </div>
            )}
          </section>

          {/* Öppettider */}
          <section className="space-y-3">
            <h3 className="font-display font-bold text-base">Öppettider (veckovis)</h3>
            {initialNonWeekly.length > 0 && (
              <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded px-2 py-1.5">
                Marknaden har {initialNonWeekly.length} datumspecifika regler som inte visas här —
                redigera dem på <span className="font-mono">/fleamarkets/{market.id}/edit</span>.
              </p>
            )}
            <div className="space-y-1">
              {WEEKDAY_ORDER.map((day) => {
                const rule = weeklyRules.find((r) => r.dayOfWeek === day)
                return (
                  <div key={day} className="flex items-center gap-2 text-sm">
                    <label className="inline-flex items-center gap-2 w-20">
                      <input
                        type="checkbox"
                        checked={!!rule}
                        onChange={(e) => toggleDay(day, e.target.checked)}
                      />
                      {DAY_LABELS[day]}
                    </label>
                    <input
                      type="time"
                      disabled={!rule}
                      value={rule?.openTime ?? ''}
                      onChange={(e) => updateRule(day, 'openTime', e.target.value)}
                      className="px-2 py-1 rounded-md border border-cream-warm disabled:bg-cream-warm/50 disabled:text-espresso/30"
                    />
                    <span className="text-espresso/50">–</span>
                    <input
                      type="time"
                      disabled={!rule}
                      value={rule?.closeTime ?? ''}
                      onChange={(e) => updateRule(day, 'closeTime', e.target.value)}
                      className="px-2 py-1 rounded-md border border-cream-warm disabled:bg-cream-warm/50 disabled:text-espresso/30"
                    />
                  </div>
                )
              })}
            </div>
          </section>

          {editMut.isError && (
            <p className="text-red-700 text-sm">Kunde inte spara: {String(editMut.error)}</p>
          )}

          <ActivitySection marketId={market.id} />
        </div>

        <footer className="sticky bottom-0 bg-card border-t border-cream-warm px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-cream-warm text-espresso hover:bg-cream-warm text-sm font-semibold"
          >
            Avbryt
          </button>
          <button
            onClick={save}
            disabled={editMut.isPending}
            className="px-4 py-2 rounded-md bg-rust text-white text-sm font-semibold disabled:opacity-50"
          >
            {editMut.isPending ? 'Sparar…' : 'Spara'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function ActivitySection({ marketId }: { marketId: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useAdminMarketActivity(open ? marketId : null)

  return (
    <section className="space-y-2 border-t border-cream-warm pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-display font-bold"
      >
        <span>Historik</span>
        <span className="text-espresso/50 text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          {isLoading && <p className="text-espresso/60 text-sm">Laddar…</p>}
          {data && data.rows.length === 0 && (
            <p className="text-espresso/50 text-sm">Inga händelser loggade.</p>
          )}
          {data && data.rows.length > 0 && (
            <ol className="space-y-2 text-xs">
              {data.rows.map((row) => <ActivityRow key={row.id} row={row} />)}
            </ol>
          )}
        </>
      )}
    </section>
  )
}

function ActivityRow({ row }: { row: AdminActivityRow }) {
  const summary = summarizeAction(row)
  return (
    <li className="border-l-2 border-cream-warm pl-3 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-espresso/85">{row.action}</span>
        <time className="text-espresso/50">
          {new Date(row.createdAt).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
        </time>
      </div>
      <div className="text-espresso/65 mt-0.5">
        {row.adminEmail ?? '—'}
        {summary && <span className="text-espresso/50"> · {summary}</span>}
      </div>
    </li>
  )
}

function summarizeAction(row: AdminActivityRow): string | null {
  const p = row.payload
  if (row.action === 'market.edit') {
    const sections = (p.sections as string[] | undefined) ?? []
    return sections.length ? `ändrade: ${sections.join(', ')}` : null
  }
  if (row.action === 'business.takeover.send') {
    const sent = (p.sent as number | undefined) ?? 0
    const skipped = (p.skipped as number | undefined) ?? 0
    const errors = (p.errors as number | undefined) ?? 0
    return `${sent} skickade · ${skipped} hoppade · ${errors} fel`
  }
  if (row.action === 'business.import.commit') {
    const c = (p.created as number | undefined) ?? 0
    const u = (p.updated as number | undefined) ?? 0
    return `import: ${c} skapade, ${u} uppdaterade`
  }
  return null
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-espresso/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm"
      />
    </label>
  )
}

type AdminMarketEditPatch = {
  contact?: { website?: string | null; facebook?: string | null; instagram?: string | null; phone?: string | null; email?: string | null }
  address?: { street?: string | null; zipCode?: string | null; city?: string | null; country?: string }
  location?: { latitude: number; longitude: number }
  openingHourRules?: Array<{ type: 'weekly' | 'biweekly' | 'date'; dayOfWeek: number | null; anchorDate: string | null; openTime: string; closeTime: string }>
}
