'use client'

import { useMemo, useState } from 'react'
import { useBusinessImport } from '@/hooks/use-business-import'
import type {
  AdminBusinessImportOutput,
  ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import'

type RowAction = AdminBusinessImportOutput['rows'][number]['action']

const ACTION_LABEL: Record<RowAction, string> = {
  create: 'Skapa',
  update: 'Uppdatera',
  unchanged: 'Oförändrad',
  error: 'Fel',
}

const ACTION_BADGE: Record<RowAction, string> = {
  create: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  update: 'bg-amber-100 text-amber-900 border-amber-300',
  unchanged: 'bg-cream-warm text-espresso/60 border-cream-warm',
  error: 'bg-red-100 text-red-900 border-red-300',
}

const DAY_LABEL: Record<string, string> = {
  monday: 'Mån', tuesday: 'Tis', wednesday: 'Ons', thursday: 'Tor',
  friday: 'Fre', saturday: 'Lör', sunday: 'Sön',
}

const CATEGORIES = ['Privat', 'Kyrklig-bistånd', 'Antik-retro', 'Kommunal', 'Kedja', 'Evenemang'] as const
const STATUSES = ['confirmed', 'unverified', 'closed'] as const

export default function AdminImportPage() {
  const importMut = useBusinessImport()
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [businesses, setBusinesses] = useState<ImportBusiness[] | null>(null)
  const [committingSlug, setCommittingSlug] = useState<string | null>(null)
  const [bulkCommitting, setBulkCommitting] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setBusinesses(null)
    setEditingSlug(null)
    importMut.reset()

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const list = Array.isArray(json) ? json : json.businesses
      if (!Array.isArray(list)) throw new Error('JSON saknar fält "businesses" som array')
      setBusinesses(list)
      await importMut.mutateAsync({ businesses: list, commit: false })
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveEdit(slug: string, updated: ImportBusiness) {
    if (!businesses) return
    const next = businesses.map((b) => (b.slug === slug ? updated : b))
    setBusinesses(next)
    setEditingSlug(null)
    await importMut.mutateAsync({ businesses: next, commit: false })
  }

  async function commitOne(slug: string) {
    if (!businesses) return
    const target = businesses.find((b) => b.slug === slug)
    if (!target) return
    setCommittingSlug(slug)
    try {
      await importMut.mutateAsync({ businesses: [target], commit: true })
      await importMut.mutateAsync({ businesses, commit: false })
    } finally {
      setCommittingSlug(null)
    }
  }

  async function commitAll(pending: ImportBusiness[]) {
    if (pending.length === 0) return
    if (!confirm(`Skapa/uppdatera ${pending.length} butiker?`)) return
    setBulkCommitting(true)
    try {
      await importMut.mutateAsync({ businesses: pending, commit: true })
      if (businesses) await importMut.mutateAsync({ businesses, commit: false })
    } finally {
      setBulkCommitting(false)
    }
  }

  const report = importMut.data
  const actionBySlug = useMemo(() => {
    const m = new Map<string, RowAction>()
    report?.rows.forEach((r) => { if (r.slug) m.set(r.slug, r.action) })
    return m
  }, [report])

  const warningsBySlug = useMemo(() => {
    const m = new Map<string, string[]>()
    report?.rows.forEach((r) => { if (r.slug) m.set(r.slug, r.warnings) })
    return m
  }, [report])

  const errorsBySlug = useMemo(() => {
    const m = new Map<string, string[]>()
    report?.rows.forEach((r) => { if (r.slug) m.set(r.slug, r.errors) })
    return m
  }, [report])

  const pending = useMemo(() => {
    if (!businesses) return []
    return businesses.filter((b) => {
      const a = actionBySlug.get(b.slug)
      return a === 'create' || a === 'update'
    })
  }, [businesses, actionBySlug])

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Importera butiker</h1>
        <p className="text-espresso/65 mt-1">
          Ladda upp en JSON-fil, granska, redigera om något är fel, och klicka
          &laquo;Skapa&raquo; per rad eller &laquo;Skapa alla&raquo; när du är nöjd. Inget skrivs
          förrän du bekräftar.
        </p>
      </section>

      <section className="flex items-center gap-4 flex-wrap">
        <label className="inline-flex items-center gap-3 cursor-pointer">
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-rust file:text-white file:font-semibold hover:file:bg-rust/90"
          />
          {fileName && <span className="text-sm text-espresso/60">{fileName}</span>}
        </label>

        {report && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-espresso/65">
              {report.summary.created} skapa · {report.summary.updated} uppdatera · {report.summary.unchanged} oförändrade · {report.summary.errors} fel
            </span>
            {pending.length > 0 && (
              <button
                onClick={() => commitAll(pending)}
                disabled={bulkCommitting || !!committingSlug || !!editingSlug}
                className="bg-emerald-700 text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
              >
                {bulkCommitting ? 'Skapar…' : `Skapa alla (${pending.length})`}
              </button>
            )}
          </div>
        )}
      </section>

      {parseError && <p className="text-red-700 text-sm">Kunde inte läsa filen: {parseError}</p>}
      {importMut.isError && !committingSlug && !bulkCommitting && (
        <p className="text-red-700 text-sm">Servern svarade med fel: {String(importMut.error)}</p>
      )}
      {importMut.isPending && !committingSlug && !bulkCommitting && (
        <p className="text-espresso/60">Validerar mot databasen…</p>
      )}

      {businesses && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {businesses.map((b, index) => {
            const action = actionBySlug.get(b.slug) ?? 'error'
            const errors = errorsBySlug.get(b.slug) ?? []
            const warnings = warningsBySlug.get(b.slug) ?? []
            // Disable the row's commit button whenever ANY mutation is in
            // flight, not just one targeting this slug — prevents racing
            // dry-runs from a fast double-click.
            const anyBusy = !!committingSlug || bulkCommitting || importMut.isPending
            const isBusy = anyBusy
            const isEditing = editingSlug === b.slug
            const isActionable = action === 'create' || action === 'update'

            if (isEditing) {
              return (
                <BusinessEditor
                  key={`${index}-${b.slug}`}
                  business={b}
                  onSave={(updated) => saveEdit(b.slug, updated)}
                  onCancel={() => setEditingSlug(null)}
                />
              )
            }

            return (
              <BusinessCard
                key={`${index}-${b.slug}`}
                business={b}
                action={action}
                errors={errors}
                warnings={warnings}
                busy={isBusy}
                canEdit={action !== 'unchanged' && !committingSlug && !bulkCommitting}
                onEdit={() => setEditingSlug(b.slug)}
                onCommit={isActionable ? () => commitOne(b.slug) : undefined}
              />
            )
          })}
        </section>
      )}
    </div>
  )
}

function BusinessCard({
  business: b,
  action,
  errors,
  warnings,
  busy,
  canEdit,
  onEdit,
  onCommit,
}: {
  business: ImportBusiness
  action: RowAction
  errors: string[]
  warnings: string[]
  busy: boolean
  canEdit: boolean
  onEdit: () => void
  onCommit?: () => void
}) {
  const address = [b.address.street, b.address.postalCode, b.address.locality]
    .filter(Boolean).join(', ')

  return (
    <article className="border border-cream-warm rounded-md p-4 space-y-3 bg-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-bold text-lg truncate">{b.name}</h3>
          <p className="text-xs font-mono text-espresso/50">{b.slug}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded border ${ACTION_BADGE[action]}`}>
          {ACTION_LABEL[action]}
        </span>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        <Pill>{b.category}</Pill>
        <Pill>{b.status}</Pill>
        {b.takeover.shouldSendEmail && <Pill tone="emerald">📮 P{b.takeover.priority}</Pill>}
        {b.distanceFromOrebroKm != null && <Pill>{b.distanceFromOrebroKm} km</Pill>}
      </div>

      {b.description && <p className="text-sm text-espresso/75 line-clamp-3">{b.description}</p>}

      <dl className="text-sm space-y-1">
        <Field label="Adress">{address || '—'}</Field>
        <Field label="Kommun/län">{b.address.municipality}, {b.address.region}</Field>
        {b.geo?.lat != null && b.geo?.lng != null && (
          <Field label="Koord">
            {b.geo.lat.toFixed(4)}, {b.geo.lng.toFixed(4)}
            {b.geo.precision && <span className="text-espresso/40 ml-2">({b.geo.precision})</span>}
          </Field>
        )}
        {b.contact?.email && <Field label="E-post"><a className="text-rust" href={`mailto:${b.contact.email}`}>{b.contact.email}</a></Field>}
        {b.contact?.phone && <Field label="Telefon">{b.contact.phoneRaw ?? b.contact.phone}</Field>}
        {b.contact?.website && <Field label="Webb"><a className="text-rust break-all" href={b.contact.website} target="_blank" rel="noreferrer">{b.contact.website}</a></Field>}
        {(b.contact?.facebook || b.contact?.instagram) && (
          <Field label="Social">
            {b.contact?.facebook && <a className="text-rust mr-3" href={b.contact.facebook} target="_blank" rel="noreferrer">FB</a>}
            {b.contact?.instagram && <a className="text-rust" href={b.contact.instagram} target="_blank" rel="noreferrer">IG</a>}
          </Field>
        )}
      </dl>

      {b.openingHours?.regular && b.openingHours.regular.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-espresso/70">Öppettider</summary>
          <ul className="mt-2 space-y-0.5 text-espresso/75">
            {b.openingHours.regular.map((h, i) => (
              <li key={i} className="tabular-nums">
                <span className="inline-block w-12 font-medium">{DAY_LABEL[h.day] ?? h.day}</span>
                {h.opens ?? '—'}–{h.closes ?? '—'}
              </li>
            ))}
          </ul>
          {b.openingHours.freeText && <p className="text-xs text-espresso/60 mt-1">{b.openingHours.freeText}</p>}
          {b.openingHours.closedMonths && b.openingHours.closedMonths.length > 0 && (
            <p className="text-xs text-espresso/60 mt-1">Stängt: {b.openingHours.closedMonths.join(', ')}</p>
          )}
        </details>
      )}

      {warnings.length > 0 && (
        <ul className="text-xs text-amber-700 list-disc list-inside">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
      {errors.length > 0 && (
        <ul className="text-xs text-red-700 list-disc list-inside">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      <footer className="pt-2 border-t border-cream-warm flex gap-2">
        {canEdit && (
          <button
            onClick={onEdit}
            className="flex-1 border border-cream-warm text-espresso px-3 py-2 rounded-md text-sm font-semibold hover:bg-cream-warm"
          >
            Redigera
          </button>
        )}
        {onCommit && (
          <button
            onClick={onCommit}
            disabled={busy}
            className="flex-1 bg-emerald-700 text-white px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {busy
              ? (action === 'create' ? 'Skapar…' : 'Uppdaterar…')
              : (action === 'create' ? 'Skapa denna' : 'Uppdatera denna')}
          </button>
        )}
      </footer>
    </article>
  )
}

function BusinessEditor({
  business,
  onSave,
  onCancel,
}: {
  business: ImportBusiness
  onSave: (b: ImportBusiness) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ImportBusiness>(business)

  function setField<K extends keyof ImportBusiness>(key: K, value: ImportBusiness[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setAddr<K extends keyof ImportBusiness['address']>(key: K, value: ImportBusiness['address'][K]) {
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }))
  }

  function setContact<K extends keyof NonNullable<ImportBusiness['contact']>>(
    key: K,
    value: NonNullable<ImportBusiness['contact']>[K],
  ) {
    setDraft((d) => ({ ...d, contact: { ...(d.contact ?? {}), [key]: value } }))
  }

  function setTakeover<K extends keyof ImportBusiness['takeover']>(key: K, value: ImportBusiness['takeover'][K]) {
    setDraft((d) => ({ ...d, takeover: { ...d.takeover, [key]: value } }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(draft)
  }

  return (
    <form onSubmit={onSubmit} className="border-2 border-rust rounded-md p-4 space-y-3 bg-card">
      <header>
        <h3 className="font-display font-bold text-lg">Redigera {business.name}</h3>
        <p className="text-xs font-mono text-espresso/50">{business.slug}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Input label="Namn" value={draft.name} onChange={(v) => setField('name', v)} required />
        <Select label="Kategori" value={draft.category} onChange={(v) => setField('category', v as ImportBusiness['category'])} options={CATEGORIES as unknown as string[]} />
        <Select label="Status" value={draft.status} onChange={(v) => setField('status', v as ImportBusiness['status'])} options={STATUSES as unknown as string[]} />
        <Input label="Distans Örebro (km)" type="number" value={draft.distanceFromOrebroKm?.toString() ?? ''} onChange={(v) => setField('distanceFromOrebroKm', v ? Number(v) : null)} />
      </div>

      <Textarea label="Beskrivning" value={draft.description ?? ''} onChange={(v) => setField('description', v || null)} rows={3} />

      <fieldset className="border-t border-cream-warm pt-3">
        <legend className="text-xs uppercase tracking-wide text-espresso/55 px-2">Adress</legend>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Input label="Gata" value={draft.address.street ?? ''} onChange={(v) => setAddr('street', v || null)} />
          <Input label="Postnr" value={draft.address.postalCode ?? ''} onChange={(v) => setAddr('postalCode', v || null)} />
          <Input label="Ort" value={draft.address.locality} onChange={(v) => setAddr('locality', v)} required />
          <Input label="Kommun" value={draft.address.municipality} onChange={(v) => setAddr('municipality', v)} required />
          <Input label="Län" value={draft.address.region} onChange={(v) => setAddr('region', v)} required />
          <Input label="Land (ISO)" value={draft.address.country} onChange={(v) => setAddr('country', v)} required />
        </div>
      </fieldset>

      <fieldset className="border-t border-cream-warm pt-3">
        <legend className="text-xs uppercase tracking-wide text-espresso/55 px-2">Kontakt</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Input label="E-post" type="email" value={draft.contact?.email ?? ''} onChange={(v) => setContact('email', v || null)} />
          <Input label="Telefon (+46...)" value={draft.contact?.phone ?? ''} onChange={(v) => setContact('phone', v || null)} />
          <Input label="Webb" value={draft.contact?.website ?? ''} onChange={(v) => setContact('website', v || null)} />
          <Input label="Facebook" value={draft.contact?.facebook ?? ''} onChange={(v) => setContact('facebook', v || null)} />
          <Input label="Instagram" value={draft.contact?.instagram ?? ''} onChange={(v) => setContact('instagram', v || null)} />
        </div>
      </fieldset>

      <fieldset className="border-t border-cream-warm pt-3 space-y-2">
        <legend className="text-xs uppercase tracking-wide text-espresso/55 px-2">Öppettider</legend>
        <OpeningHoursEditor
          value={draft.openingHours ?? {}}
          onChange={(oh) => setField('openingHours', oh)}
        />
      </fieldset>

      <fieldset className="border-t border-cream-warm pt-3">
        <legend className="text-xs uppercase tracking-wide text-espresso/55 px-2">Takeover</legend>
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.takeover.shouldSendEmail}
              onChange={(e) => setTakeover('shouldSendEmail', e.target.checked)}
            />
            Skicka inbjudan
          </label>
          <Select
            label="Prioritet"
            value={String(draft.takeover.priority)}
            onChange={(v) => setTakeover('priority', Number(v) as 1 | 2 | 3)}
            options={['1', '2', '3']}
          />
        </div>
      </fieldset>

      <footer className="flex gap-2 pt-2 border-t border-cream-warm">
        <button type="button" onClick={onCancel} className="flex-1 border border-cream-warm text-espresso px-3 py-2 rounded-md text-sm font-semibold hover:bg-cream-warm">
          Avbryt
        </button>
        <button type="submit" className="flex-1 bg-rust text-white px-3 py-2 rounded-md text-sm font-semibold">
          Spara
        </button>
      </footer>
    </form>
  )
}

const DAYS: { key: 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'; label: string }[] = [
  { key: 'monday', label: 'Mån' },
  { key: 'tuesday', label: 'Tis' },
  { key: 'wednesday', label: 'Ons' },
  { key: 'thursday', label: 'Tor' },
  { key: 'friday', label: 'Fre' },
  { key: 'saturday', label: 'Lör' },
  { key: 'sunday', label: 'Sön' },
]

const MONTHS: { key: string; label: string }[] = [
  { key: 'january', label: 'Jan' }, { key: 'february', label: 'Feb' },
  { key: 'march', label: 'Mar' }, { key: 'april', label: 'Apr' },
  { key: 'may', label: 'Maj' }, { key: 'june', label: 'Jun' },
  { key: 'july', label: 'Jul' }, { key: 'august', label: 'Aug' },
  { key: 'september', label: 'Sep' }, { key: 'october', label: 'Okt' },
  { key: 'november', label: 'Nov' }, { key: 'december', label: 'Dec' },
]

type OpeningHours = NonNullable<ImportBusiness['openingHours']>
type DayRow = NonNullable<OpeningHours['regular']>[number]

function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours
  onChange: (v: OpeningHours) => void
}) {
  const regular = value.regular ?? []
  const closedMonths = value.closedMonths ?? []

  function toggleDay(day: DayRow['day'], enabled: boolean) {
    if (enabled) {
      if (regular.some((r) => r.day === day)) return
      onChange({ ...value, regular: [...regular, { day, opens: '10:00', closes: '17:00' }] })
    } else {
      onChange({ ...value, regular: regular.filter((r) => r.day !== day) })
    }
  }

  function updateDay(day: DayRow['day'], field: 'opens' | 'closes', v: string) {
    onChange({
      ...value,
      regular: regular.map((r) => (r.day === day ? { ...r, [field]: v || null } : r)),
    })
  }

  function toggleMonth(month: string, enabled: boolean) {
    const next = enabled
      ? [...closedMonths, month]
      : closedMonths.filter((m) => m !== month)
    onChange({ ...value, closedMonths: next.length ? next : null })
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
        ⚠ Öppettider skrivs inte till databasen via importen ännu — redigera
        manuellt på butikens sida efter att den skapats.
      </p>
      <div className="space-y-1">
        {DAYS.map(({ key, label }) => {
          const row = regular.find((r) => r.day === key)
          return (
            <div key={key} className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 w-20">
                <input
                  type="checkbox"
                  checked={!!row}
                  onChange={(e) => toggleDay(key, e.target.checked)}
                />
                {label}
              </label>
              <input
                type="time"
                disabled={!row}
                value={row?.opens ?? ''}
                onChange={(e) => updateDay(key, 'opens', e.target.value)}
                className="px-2 py-1 rounded-md border border-cream-warm disabled:bg-cream-warm/50 disabled:text-espresso/30"
              />
              <span className="text-espresso/50">–</span>
              <input
                type="time"
                disabled={!row}
                value={row?.closes ?? ''}
                onChange={(e) => updateDay(key, 'closes', e.target.value)}
                className="px-2 py-1 rounded-md border border-cream-warm disabled:bg-cream-warm/50 disabled:text-espresso/30"
              />
            </div>
          )
        })}
      </div>

      <div>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-espresso/55">Fri text (säsong, bokning, etc.)</span>
          <textarea
            value={value.freeText ?? ''}
            onChange={(e) => onChange({ ...value, freeText: e.target.value || null })}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm"
          />
        </label>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-espresso/55">Stängda månader</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {MONTHS.map(({ key, label }) => {
            const checked = closedMonths.includes(key)
            return (
              <label key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer ${checked ? 'bg-rust text-white border-rust' : 'border-cream-warm hover:bg-cream-warm'}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleMonth(key, e.target.checked)}
                  className="sr-only"
                />
                {label}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Input({
  label, value, onChange, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-espresso/55">{label}{required && ' *'}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm"
      />
    </label>
  )
}

function Textarea({
  label, value, onChange, rows = 2,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wide text-espresso/55">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm"
      />
    </label>
  )
}

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-espresso/55">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm bg-white"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'emerald' }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-cream-warm text-espresso/75 border-cream-warm'
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>{children}</span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-espresso/50 w-20 shrink-0 text-xs uppercase tracking-wide pt-0.5">{label}</dt>
      <dd className="flex-1 min-w-0 break-words">{children}</dd>
    </div>
  )
}
