'use client'

import { useState } from 'react'
import { validateBlockSaleInput } from '@fyndstigen/shared/block-sale'

const REASON_LABEL: Record<string, string> = {
  name_length: 'Namnet måste vara 3–120 tecken.',
  city_length: 'Stad krävs (max 80 tecken).',
  start_date_format: 'Ogiltigt startdatum.',
  end_date_format: 'Ogiltigt slutdatum.',
  open_format: 'Ogiltigt öppningstid (HH:MM).',
  close_format: 'Ogiltig stängningstid (HH:MM).',
  start_in_past: 'Startdatum måste vara idag eller senare.',
  end_before_start: 'Slutdatum kan inte vara före startdatum.',
  close_before_open: 'Stängningstid måste vara efter öppningstid.',
}

function labelFor(reason: string): string {
  return REASON_LABEL[reason] ?? `Valideringsfel: ${reason}`
}

function tomorrowIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export type BlockSaleFormInput = {
  name: string
  description?: string
  startDate: string
  endDate: string
  dailyOpen: string
  dailyClose: string
  city: string
  region?: string
  street?: string
  publish: boolean
}

type Props = {
  onSubmit: (input: BlockSaleFormInput) => Promise<void>
  busy?: boolean
  error?: unknown
}

export function BlockSaleForm({ onSubmit, busy, error }: Props) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: tomorrowIso(),
    endDate: tomorrowIso(),
    dailyOpen: '10:00',
    dailyClose: '15:00',
    city: '',
    region: '',
    street: '',
    publish: false,
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    const result = validateBlockSaleInput({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      dailyOpen: form.dailyOpen,
      dailyClose: form.dailyClose,
      city: form.city.trim(),
    })

    if (!result.ok) {
      setValidationError(labelFor(result.reason))
      return
    }

    await onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      dailyOpen: form.dailyOpen,
      dailyClose: form.dailyClose,
      city: form.city.trim(),
      region: form.region.trim() || undefined,
      street: form.street.trim() || undefined,
      publish: form.publish,
    })
  }

  const displayError = validationError ?? (error instanceof Error ? error.message : error ? String(error) : null)

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-cream-warm rounded-card p-6">
      <Field label="Namn på kvartersloppisen">
        <input
          type="text"
          required
          maxLength={120}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="T.ex. Sommarloppis i Stiggatan"
          className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
        />
      </Field>

      <Field label="Beskrivning" hint="Valfritt — berätta lite om eventet.">
        <textarea
          maxLength={2000}
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Välkommen till vår gemensamma kvartersloppis! Alla grannar hälsas välkomna..."
          className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest resize-y"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Startdatum">
          <input
            type="date"
            required
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
          />
        </Field>
        <Field label="Slutdatum">
          <input
            type="date"
            required
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            min={form.startDate}
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Öppnar">
          <input
            type="time"
            required
            value={form.dailyOpen}
            onChange={(e) => setForm({ ...form, dailyOpen: e.target.value })}
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
          />
        </Field>
        <Field label="Stänger">
          <input
            type="time"
            required
            value={form.dailyClose}
            onChange={(e) => setForm({ ...form, dailyClose: e.target.value })}
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
          />
        </Field>
      </div>

      <Field label="Stad">
        <input
          type="text"
          required
          maxLength={80}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Örebro"
          className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
        />
      </Field>

      <Field label="Region" hint="Valfritt — t.ex. Örebro län.">
        <input
          type="text"
          maxLength={80}
          value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })}
          placeholder="Örebro län"
          className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
        />
      </Field>

      <Field label="Adress" hint="Valfritt — kvarteret eller en central gata. Hjälper besökare hitta rätt.">
        <input
          type="text"
          maxLength={200}
          value={form.street}
          onChange={(e) => setForm({ ...form, street: e.target.value })}
          placeholder="T.ex. Stiggatan / Björkgatan"
          className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
        />
      </Field>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.publish}
          onChange={(e) => setForm({ ...form, publish: e.target.checked })}
          className="w-4 h-4 accent-forest rounded"
        />
        <span className="text-sm font-medium text-espresso">Publicera direkt</span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-forest text-white px-5 py-3 rounded-pill font-bold disabled:opacity-50 hover:bg-forest-light transition-colors"
      >
        {busy ? 'Skapar…' : 'Skapa kvartersloppis'}
      </button>

      {displayError && (
        <p className="text-error text-sm text-center">{displayError}</p>
      )}
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-bold text-espresso-light mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-espresso/55 mt-1">{hint}</span>}
    </label>
  )
}
