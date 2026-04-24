'use client'

import { useState } from 'react'
import { useBusinessImportDryRun } from '@/hooks/use-business-import'
import type { AdminBusinessImportOutput } from '@fyndstigen/shared/contracts/admin-business-import'

const ACTION_LABEL: Record<AdminBusinessImportOutput['rows'][number]['action'], string> = {
  create: 'Skapa',
  update: 'Uppdatera',
  unchanged: 'Oförändrad',
  error: 'Fel',
}

const ACTION_COLOR: Record<AdminBusinessImportOutput['rows'][number]['action'], string> = {
  create: 'text-emerald-700',
  update: 'text-amber-700',
  unchanged: 'text-espresso/50',
  error: 'text-red-700',
}

export default function AdminImportPage() {
  const dryRun = useBusinessImportDryRun()
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    dryRun.reset()

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const businesses = Array.isArray(json) ? json : json.businesses
      if (!Array.isArray(businesses)) {
        throw new Error('JSON saknar fält "businesses" som array')
      }
      await dryRun.mutateAsync(businesses)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  const result = dryRun.data

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Importera butiker</h1>
        <p className="text-espresso/65 mt-1">
          Ladda upp en JSON-fil enligt fyndstigen-import-formatet. Detta är en
          torrkörning — inget skrivs till databasen.
        </p>
      </section>

      <section>
        <label className="inline-flex items-center gap-3 cursor-pointer">
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-rust file:text-white file:font-semibold hover:file:bg-rust/90"
          />
          {fileName && <span className="text-sm text-espresso/60">{fileName}</span>}
        </label>
      </section>

      {dryRun.isPending && <p className="text-espresso/60">Validerar mot databasen…</p>}

      {parseError && (
        <p className="text-red-700 text-sm">Kunde inte läsa filen: {parseError}</p>
      )}

      {dryRun.isError && (
        <p className="text-red-700 text-sm">Servern svarade med fel: {String(dryRun.error)}</p>
      )}

      {result && <DryRunSummary result={result} />}
    </div>
  )
}

function DryRunSummary({ result }: { result: AdminBusinessImportOutput }) {
  const { summary, rows } = result
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <Stat label="Totalt" value={summary.total} />
        <Stat label="Skapas" value={summary.created} tone="text-emerald-700" />
        <Stat label="Uppdateras" value={summary.updated} tone="text-amber-700" />
        <Stat label="Oförändrade" value={summary.unchanged} tone="text-espresso/50" />
        <Stat label="Fel" value={summary.errors} tone="text-red-700" />
        <Stat label="Varningar" value={summary.warnings} tone="text-amber-700" />
      </section>

      <section>
        <h2 className="font-display text-xl font-bold mb-3">Per butik</h2>
        <ul className="divide-y divide-cream-warm">
          {rows.map((row) => (
            <li key={`${row.index}-${row.slug}`} className="py-3 text-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-espresso/40 tabular-nums w-8">#{row.index + 1}</span>
                <span className={`font-semibold w-24 ${ACTION_COLOR[row.action]}`}>
                  {ACTION_LABEL[row.action]}
                </span>
                <span className="font-mono text-espresso/80">{row.slug ?? '(slug saknas)'}</span>
              </div>
              {row.errors.length > 0 && (
                <ul className="mt-1 ml-32 text-red-700 list-disc list-inside">
                  {row.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {row.warnings.length > 0 && (
                <ul className="mt-1 ml-32 text-amber-700 list-disc list-inside">
                  {row.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value, tone = 'text-espresso' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-cream-warm p-3">
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-espresso/55 mt-1">{label}</div>
    </div>
  )
}
