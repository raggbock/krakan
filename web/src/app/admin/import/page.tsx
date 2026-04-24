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

export default function AdminImportPage() {
  const importMut = useBusinessImport()
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [businesses, setBusinesses] = useState<ImportBusiness[] | null>(null)
  const [committingSlug, setCommittingSlug] = useState<string | null>(null)
  const [bulkCommitting, setBulkCommitting] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setBusinesses(null)
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

  async function commitOne(slug: string) {
    if (!businesses) return
    const target = businesses.find((b) => b.slug === slug)
    if (!target) return
    setCommittingSlug(slug)
    try {
      await importMut.mutateAsync({ businesses: [target], commit: true })
      // Re-fetch dry-run to refresh the combined state for the full list.
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
      if (businesses) {
        await importMut.mutateAsync({ businesses, commit: false })
      }
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
          Ladda upp en JSON-fil, granska varje butik, och klicka &laquo;Skapa&raquo; per rad
          eller &laquo;Skapa alla&raquo; när du är nöjd. Inget skrivs förrän du bekräftar.
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
                disabled={bulkCommitting || !!committingSlug}
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
            const isBusy = committingSlug === b.slug || bulkCommitting
            const isActionable = action === 'create' || action === 'update'
            return (
              <BusinessCard
                key={`${index}-${b.slug}`}
                business={b}
                action={action}
                errors={errors}
                warnings={warnings}
                busy={isBusy}
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
  onCommit,
}: {
  business: ImportBusiness
  action: RowAction
  errors: string[]
  warnings: string[]
  busy: boolean
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

      {onCommit && (
        <footer className="pt-2 border-t border-cream-warm">
          <button
            onClick={onCommit}
            disabled={busy}
            className="w-full bg-emerald-700 text-white px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Skapar…' : action === 'create' ? 'Skapa denna' : 'Uppdatera denna'}
          </button>
        </footer>
      )}
    </article>
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
