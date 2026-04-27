'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { usePublicMarketCreate } from '@/hooks/use-public-market-create'

const ERROR_LABEL: Record<string, string> = {
  date_in_past: 'Datumet måste vara idag eller senare.',
  too_many_drafts: 'Du har redan skapat flera loppisar idag. Försök igen i morgon eller logga in på den befintliga.',
  slug_generation_failed: 'Kunde inte skapa unik adress. Prova ett lite annat namn.',
}

function labelFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return ERROR_LABEL[msg] ?? 'Något gick fel. Försök igen om en stund.'
}

// Default to "i morgon" so a Facebook-poster who fires this off in the
// evening doesn't have to mentally adjust the picker.
function tomorrowIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function SkapaPage() {
  const create = usePublicMarketCreate()
  const [form, setForm] = useState({
    name: '',
    city: '',
    date: tomorrowIso(),
    openTime: '10:00',
    closeTime: '15:00',
    street: '',
    email: '',
  })
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      name: form.name.trim(),
      city: form.city.trim(),
      date: form.date,
      openTime: form.openTime,
      closeTime: form.closeTime,
      street: form.street.trim() || undefined,
      email: form.email.trim().toLowerCase(),
    })
    setSubmittedEmail(form.email.trim().toLowerCase())
  }

  if (submittedEmail) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-forest text-parchment grid place-items-center text-3xl font-bold">
            ✓
          </div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-3">
            Sidan är skapad!
          </h1>
          <p className="text-espresso-light font-medium leading-relaxed">
            Vi har skickat en länk till <strong>{submittedEmail}</strong>. Klicka
            på den för att slutföra: lägg till bilder, beskrivning och tryck på
            Publicera när ni är klara.
          </p>
          <p className="text-espresso/55 text-sm mt-6">
            Hittar du inget mejl? Kolla skräpposten — det kommer från
            noreply@fyndstigen.se.
          </p>
        </div>
      </Centered>
    )
  }

  return (
    <Centered>
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <FyndstigenLogo size={36} className="text-rust mx-auto mb-3" />
          <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-espresso">
            Skapa er loppis-sida
          </h1>
          <p className="text-espresso-light font-medium mt-3">
            Tar 30 sekunder. Inget konto krävs — vi mejlar en länk så du kan
            slutföra och publicera.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4 bg-card border border-cream-warm rounded-card p-6">
          <Field label="Loppisens namn">
            <input
              type="text"
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="T.ex. Vårloppis i Brevik"
              className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
            />
          </Field>

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

          <Field label="Datum">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Öppnar">
              <input
                type="time"
                required
                value={form.openTime}
                onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
              />
            </Field>
            <Field label="Stänger">
              <input
                type="time"
                required
                value={form.closeTime}
                onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
                className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
              />
            </Field>
          </div>

          <Field label="Adress" hint="Valfritt — kan läggas till senare. Behövs för att synas på kartan.">
            <input
              type="text"
              maxLength={200}
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              placeholder="T.ex. Storgatan 12"
              className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
            />
          </Field>

          <Field label="Din e-post" hint="Vi skickar en länk hit för att verifiera och redigera sidan.">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="du@exempel.se"
              className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
            />
          </Field>

          <button
            type="submit"
            disabled={create.isPending}
            className="w-full bg-forest text-parchment px-5 py-3 rounded-pill font-bold disabled:opacity-50 hover:bg-forest-light transition-colors"
          >
            {create.isPending ? 'Skapar…' : 'Skapa sidan'}
          </button>

          {create.isError && (
            <p className="text-error text-sm text-center">{labelFor(create.error)}</p>
          )}

          <p className="text-xs text-espresso/55 text-center pt-2">
            Genom att fortsätta godkänner du{' '}
            <Link href="/integritetspolicy" className="underline">integritetspolicyn</Link>.
          </p>
        </form>
      </div>
    </Centered>
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center p-6">{children}</main>
  )
}
